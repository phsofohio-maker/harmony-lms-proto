/**
 * Course Export Service
 *
 * Reads a course (course doc + modules + blocks + glossary terms) from Firestore
 * and renders a deterministic, human-readable Markdown document.
 *
 * Design constraints:
 * - Pure read on Firestore — no Cloud Functions, no rule changes.
 * - Deterministic: identical course state → byte-identical Markdown
 *   (modulo the export timestamp lines, which are explicitly time-sensitive).
 * - Lossless within scope: binary media is referenced by URL only.
 * - Caller is responsible for the browser download (Blob + anchor click).
 *
 * @module services/courseExportService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { auditService } from './auditService';
import { getTermsForCourse, GlossaryTerm } from './glossaryService';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';

const COURSES_COLLECTION = 'courses';
const MODULES_SUBCOLLECTION = 'modules';
const BLOCKS_SUBCOLLECTION = 'blocks';

const SCHEMA_VERSION = '1.0' as const;

export interface CourseExportOptions {
  courseId: string;
  actorId: string;
  actorName: string;
}

export interface CourseExportManifest {
  schemaVersion: typeof SCHEMA_VERSION;
  courseId: string;
  moduleCount: number;
  blockCount: number;
  questionCount: number;
  glossaryTermCount: number;
  exportedAt: string;
  exportedBy: string;
}

export interface CourseExportResult {
  filename: string;
  markdown: string;
  manifest: CourseExportManifest;
}

export type CourseExportErrorCode = 'NOT_FOUND' | 'READ_FAILED';

export class CourseExportError extends Error {
  readonly code: CourseExportErrorCode;
  constructor(code: CourseExportErrorCode, message: string) {
    super(message);
    this.name = 'CourseExportError';
    this.code = code;
  }
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return '';
}

function slugify(input: string): string {
  return (input || 'course')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'course';
}

function safeIsoForFilename(iso: string): string {
  return iso.replace(/:/g, '-');
}

function escapeBackticks(s: string): string {
  return s.replace(/`/g, '​`');
}

interface RawCourseDoc {
  title?: string;
  description?: string;
  status?: string;
  category?: string;
  ceCredits?: number;
  passingScore?: number;
  estimatedMinutes?: number;
  estimatedHours?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  createdByName?: string;
  authorId?: string;
  authorDisplayName?: string;
  [k: string]: unknown;
}

interface RawModuleDoc {
  id: string;
  title: string;
  description: string;
  order: number;
  status: string;
  passingScore: number;
  estimatedMinutes: number;
  weight: number;
  isCritical: boolean;
  updatedAt: string;
  raw: Record<string, any>;
}

interface RawBlockDoc {
  id: string;
  type: string;
  order: number;
  required: boolean;
  data: Record<string, any>;
}

async function readCourse(courseId: string): Promise<RawCourseDoc> {
  const ref = doc(db, COURSES_COLLECTION, courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new CourseExportError('NOT_FOUND', `Course ${courseId} not found`);
  }
  return snap.data() as RawCourseDoc;
}

async function readModules(courseId: string): Promise<RawModuleDoc[]> {
  const modsRef = collection(db, COURSES_COLLECTION, courseId, MODULES_SUBCOLLECTION);
  const q = query(modsRef, orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, any>;
    return {
      id: d.id,
      title: String(data.title ?? ''),
      description: String(data.description ?? ''),
      order: typeof data.order === 'number' ? data.order : 0,
      status: String(data.status ?? 'draft'),
      passingScore: typeof data.passingScore === 'number' ? data.passingScore : 70,
      estimatedMinutes: typeof data.estimatedMinutes === 'number' ? data.estimatedMinutes : 0,
      weight: typeof data.weight === 'number' ? data.weight : 0,
      isCritical: Boolean(data.isCritical),
      updatedAt: toIso(data.updatedAt),
      raw: data,
    };
  });
}

async function readBlocks(courseId: string, moduleId: string): Promise<RawBlockDoc[]> {
  const blocksRef = collection(
    db,
    COURSES_COLLECTION,
    courseId,
    MODULES_SUBCOLLECTION,
    moduleId,
    BLOCKS_SUBCOLLECTION
  );
  const q = query(blocksRef, orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, any>;
    return {
      id: d.id,
      type: String(data.type ?? 'text'),
      order: typeof data.order === 'number' ? data.order : 0,
      required: data.required ?? true,
      data: (data.data ?? {}) as Record<string, any>,
    };
  });
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'multiple_choice',
  'multiple_choice': 'multiple_choice',
  'true-false': 'true_false',
  'true_false': 'true_false',
  'fill-blank': 'fill_blank',
  'fill_blank': 'fill_blank',
  'matching': 'matching',
  'short-answer': 'short_answer',
  'short_answer': 'short_answer',
  'multiple-answer': 'multiple_answer',
  'multiple_answer': 'multiple_answer',
};

function letterFor(index: number): string {
  return String.fromCharCode(97 + index);
}

function renderQuestion(q: any, index: number): string[] {
  const lines: string[] = [];
  const rawType = String(q?.type ?? 'unknown');
  const normalizedType = QUESTION_TYPE_LABELS[rawType] ?? rawType;
  const prompt = String(q?.question ?? '');
  const points = typeof q?.points === 'number' ? q.points : 0;
  const explanation = q?.explanation ? String(q.explanation) : '';
  const options: string[] = Array.isArray(q?.options) ? q.options.map(String) : [];

  lines.push(`#### Question ${index + 1} (${normalizedType})`);
  lines.push('');
  lines.push(`**Prompt:** ${prompt}`);
  lines.push('');

  switch (normalizedType) {
    case 'multiple_choice': {
      const correctIdx = typeof q?.correctAnswer === 'number' ? q.correctAnswer : -1;
      options.forEach((opt, i) => {
        const marker = i === correctIdx ? '  ← CORRECT' : '';
        lines.push(`- ${letterFor(i)}. ${opt}${marker}`);
      });
      break;
    }
    case 'multiple_answer': {
      const correct: number[] = Array.isArray(q?.correctAnswer) ? q.correctAnswer : [];
      const set = new Set(correct);
      options.forEach((opt, i) => {
        const marker = set.has(i) ? '  ← CORRECT' : '';
        lines.push(`- ${letterFor(i)}. ${opt}${marker}`);
      });
      break;
    }
    case 'true_false': {
      const correctIdx = typeof q?.correctAnswer === 'number' ? q.correctAnswer : -1;
      // Convention: 0 = True, 1 = False (matches existing TipTap quiz model).
      const trueMark = correctIdx === 0 ? '  ← CORRECT' : '';
      const falseMark = correctIdx === 1 ? '  ← CORRECT' : '';
      lines.push(`- True${trueMark}`);
      lines.push(`- False${falseMark}`);
      break;
    }
    case 'fill_blank': {
      const answer = q?.correctAnswer != null ? String(q.correctAnswer) : '';
      lines.push(`**Correct Answer:** \`${escapeBackticks(answer)}\``);
      break;
    }
    case 'matching': {
      const pairs: Array<{ left: string; right: string }> = Array.isArray(q?.matchingPairs)
        ? q.matchingPairs
        : [];
      if (pairs.length === 0) {
        lines.push('*No matching pairs defined.*');
      } else {
        pairs.forEach((p, i) => {
          lines.push(`- ${i + 1}. **${p.left}** → ${p.right}`);
        });
      }
      break;
    }
    case 'short_answer': {
      const rubric = q?.correctAnswer != null ? String(q.correctAnswer) : '';
      lines.push(`**Rubric / Reference Answer:** ${rubric || '*[none provided]*'}`);
      break;
    }
    default: {
      lines.push(`> **Unknown question type:** ${rawType}`);
      console.warn(`[courseExport] Unknown question type rendered as placeholder: ${rawType}`);
    }
  }

  lines.push('');
  lines.push(`**Explanation:** ${explanation || '*[none provided]*'}`);
  lines.push(`**Points:** ${points}`);
  lines.push('');
  return lines;
}

function renderBlock(block: RawBlockDoc, index: number): { lines: string[]; questionCount: number } {
  const lines: string[] = [];
  const data = block.data || {};
  let questionCount = 0;

  lines.push(`### Block ${index + 1} (${block.type})`);
  lines.push('');

  switch (block.type) {
    case 'heading': {
      const content = String(data.content ?? '');
      const level = Math.min(3, Math.max(1, Number(data.level) || 2));
      lines.push('#'.repeat(level + 2) + ' ' + htmlToMarkdown(content).replace(/^#+\s*/, ''));
      lines.push('');
      break;
    }
    case 'text': {
      const content = String(data.content ?? '');
      const variant = data.variant ? String(data.variant) : '';
      if (variant && variant !== 'paragraph') {
        lines.push(`> *Variant: ${variant}*`);
        lines.push('');
      }
      const md = htmlToMarkdown(content);
      if (md) {
        lines.push(md);
        lines.push('');
      } else {
        lines.push('*[empty text block]*');
        lines.push('');
      }
      break;
    }
    case 'image': {
      const url = String(data.url ?? '');
      const alt = String(data.altText ?? '').trim();
      const caption = data.caption ? String(data.caption) : '';
      lines.push(`> **Image:** ${alt || '[no alt text provided]'}`);
      lines.push(`> **URL:** ${url || '[no url]'}`);
      if (caption) lines.push(`> **Caption:** ${caption}`);
      lines.push('');
      break;
    }
    case 'video': {
      const url = String(data.url ?? '');
      const title = String(data.title ?? '');
      const duration = data.duration != null ? `${data.duration}s` : '';
      lines.push(`> **Video:** ${title || '[untitled]'}`);
      lines.push(`> **URL:** ${url || '[no url]'}`);
      if (duration) lines.push(`> **Duration:** ${duration}`);
      lines.push('');
      break;
    }
    case 'quiz': {
      const title = String(data.title ?? '');
      const passingScore = data.passingScore != null ? `${data.passingScore}%` : '';
      const questions: any[] = Array.isArray(data.questions) ? data.questions : [];
      questionCount = questions.length;
      if (title) {
        lines.push(`**Quiz:** ${title}`);
        lines.push('');
      }
      if (passingScore) {
        lines.push(`**Passing Score:** ${passingScore}`);
        lines.push('');
      }
      if (questions.length === 0) {
        lines.push('*No questions in this quiz.*');
        lines.push('');
      } else {
        questions.forEach((q, i) => {
          lines.push(...renderQuestion(q, i));
        });
      }
      break;
    }
    case 'checklist': {
      const title = String(data.title ?? '');
      const items: any[] = Array.isArray(data.items) ? data.items : [];
      if (title) {
        lines.push(`**Checklist:** ${title}`);
        lines.push('');
      }
      if (items.length === 0) {
        lines.push('*No items.*');
      } else {
        items.forEach((it: any) => {
          const req = it?.required ? ' *(required)*' : '';
          lines.push(`- [ ] ${String(it?.label ?? '')}${req}`);
        });
      }
      lines.push('');
      break;
    }
    case 'correction_log': {
      const title = String(data.title ?? '');
      const entries: any[] = Array.isArray(data.entries) ? data.entries : [];
      if (title) {
        lines.push(`**Correction Log:** ${title}`);
        lines.push('');
      }
      if (entries.length === 0) {
        lines.push('*No entries.*');
      } else {
        entries.forEach((e: any) => {
          const flag = e?.isOriginal ? '[original]' : '[correction]';
          lines.push(`- ${flag} **${String(e?.author ?? '')}** — ${String(e?.text ?? '')}`);
        });
      }
      lines.push('');
      break;
    }
    case 'obj_subj_validator': {
      const title = String(data.title ?? '');
      const items: any[] = Array.isArray(data.items) ? data.items : [];
      if (title) {
        lines.push(`**Validator:** ${title}`);
        lines.push('');
      }
      if (items.length === 0) {
        lines.push('*No items.*');
      } else {
        items.forEach((it: any) => {
          lines.push(`- (${String(it?.category ?? 'unspecified')}) ${String(it?.text ?? '')}`);
        });
      }
      lines.push('');
      break;
    }
    case 'flashcard':
    case 'drag_drop': {
      lines.push('*[Interactive block — content omitted from text export.]*');
      lines.push('');
      break;
    }
    default: {
      lines.push(`> **Unknown block type:** ${block.type}`);
      lines.push('');
      console.warn(`[courseExport] Unknown block type rendered as placeholder: ${block.type}`);
      break;
    }
  }

  return { lines, questionCount };
}

function renderGlossary(terms: GlossaryTerm[]): string[] {
  const lines: string[] = [];
  lines.push('## Glossary Terms');
  lines.push('');
  if (terms.length === 0) {
    lines.push('> *No glossary terms defined for this course.*');
    lines.push('');
    return lines;
  }
  // getTermsForCourse already orders by 'term' ascending.
  for (const t of terms) {
    lines.push(`- **${t.term}**: ${t.definition}`);
    lines.push(`  *Created by ${t.createdByName || t.createdBy || 'unknown'} on ${t.createdAt || 'unknown'}*`);
  }
  lines.push('');
  return lines;
}

export async function exportCourseToMarkdown(
  options: CourseExportOptions
): Promise<CourseExportResult> {
  const { courseId, actorId, actorName } = options;
  const exportedAtIso = new Date().toISOString();

  // 1) Course
  const course = await readCourse(courseId);

  // 2) Modules
  const modules = await readModules(courseId);

  // 3) Blocks for each module (sequential, for deterministic ordering and rule simplicity)
  const moduleBlocks: RawBlockDoc[][] = [];
  for (const m of modules) {
    moduleBlocks.push(await readBlocks(courseId, m.id));
  }

  // 4) Glossary
  let terms: GlossaryTerm[] = [];
  try {
    terms = await getTermsForCourse(courseId);
  } catch (err) {
    console.warn('[courseExport] Failed to load glossary terms; continuing with empty list', err);
    terms = [];
  }

  // 5) Counts (derived, never read from cached fields)
  const moduleCount = modules.length;
  let blockCount = 0;
  let questionCount = 0;
  moduleBlocks.forEach((blocks) => {
    blockCount += blocks.length;
    blocks.forEach((b) => {
      if (b.type === 'quiz' && Array.isArray(b.data?.questions)) {
        questionCount += b.data.questions.length;
      }
    });
  });

  // 6) Assemble Markdown
  const out: string[] = [];
  const courseTitle = String(course.title ?? '').trim() || '(Untitled course)';
  const courseDescription = String(course.description ?? '');
  const courseStatus = String(course.status ?? 'draft');
  const authorId = String(course.authorId ?? course.createdBy ?? '') || '[unknown]';
  const authorName =
    String(course.authorDisplayName ?? course.createdByName ?? '') || '[unknown]';
  const createdAt = toIso(course.createdAt) || '[unknown]';
  const updatedAt = toIso(course.updatedAt) || '[unknown]';

  // Header
  out.push(`# ${courseTitle}`);
  out.push('');
  out.push(`**Course ID:** \`${courseId}\``);
  out.push(`**Status:** ${courseStatus}`);
  out.push(`**Author:** ${authorName} (${authorId})`);
  out.push(`**Created:** ${createdAt}`);
  out.push(`**Last Updated:** ${updatedAt}`);
  out.push(`**Exported:** ${exportedAtIso}`);
  out.push(`**Exported By:** ${actorName} (${actorId})`);
  out.push('');
  out.push('---');
  out.push('');

  // Description
  out.push('## Course Description');
  out.push('');
  out.push(courseDescription ? htmlToMarkdown(courseDescription) : '*[no description]*');
  out.push('');

  // Course metadata
  const passingScore =
    typeof course.passingScore === 'number'
      ? `${course.passingScore}%`
      : modules.length > 0
        ? `${Math.round(modules.reduce((s, m) => s + (m.passingScore || 0), 0) / modules.length)}% (avg of modules)`
        : 'N/A';
  const estimatedMinutes =
    typeof course.estimatedMinutes === 'number'
      ? course.estimatedMinutes
      : typeof course.estimatedHours === 'number'
        ? Math.round(course.estimatedHours * 60)
        : modules.reduce((s, m) => s + (m.estimatedMinutes || 0), 0);

  out.push('## Course Metadata');
  out.push('');
  out.push(`- **Passing Score:** ${passingScore}`);
  out.push(`- **Estimated Duration:** ${estimatedMinutes} minutes`);
  out.push(`- **Module Count:** ${moduleCount}`);
  out.push(`- **Total Question Count:** ${questionCount}`);
  out.push(`- **Total Block Count:** ${blockCount}`);
  if (typeof course.ceCredits === 'number') {
    out.push(`- **CE Credits:** ${course.ceCredits}`);
  }
  if (course.category) {
    out.push(`- **Category:** ${String(course.category)}`);
  }
  out.push('');
  out.push('---');
  out.push('');

  // Modules
  if (modules.length === 0) {
    out.push('## Modules');
    out.push('');
    out.push('*This course has no modules.*');
    out.push('');
  } else {
    modules.forEach((m, i) => {
      const blocks = moduleBlocks[i];
      const moduleQuestionCount = blocks.reduce(
        (sum, b) => sum + (b.type === 'quiz' && Array.isArray(b.data?.questions) ? b.data.questions.length : 0),
        0
      );
      out.push(`## Module ${i + 1}: ${m.title || '(Untitled module)'}`);
      out.push('');
      out.push(`**Module ID:** \`${m.id}\``);
      out.push(`**Order:** ${i + 1} of ${modules.length}`);
      out.push(`**Status:** ${m.status}`);
      out.push(`**Passing Score:** ${m.passingScore}%`);
      out.push(`**Weight:** ${m.weight}%`);
      out.push(`**Critical:** ${m.isCritical ? 'yes' : 'no'}`);
      out.push(`**Estimated Minutes:** ${m.estimatedMinutes}`);
      out.push(`**Block Count:** ${blocks.length}`);
      out.push(`**Question Count:** ${moduleQuestionCount}`);
      out.push('');
      if (m.description) {
        out.push('**Description:**');
        out.push('');
        out.push(htmlToMarkdown(m.description));
        out.push('');
      }
      if (blocks.length === 0) {
        out.push('*This module has no content blocks.*');
        out.push('');
      } else {
        blocks.forEach((b, bi) => {
          const rendered = renderBlock(b, bi);
          out.push(...rendered.lines);
        });
      }
      out.push('---');
      out.push('');
    });
  }

  // Glossary
  out.push(...renderGlossary(terms));
  out.push('---');
  out.push('');

  // Manifest
  const moduleSnapshotTimestamps = modules.map((m) => `\`${m.id}\`: ${m.updatedAt || '[unknown]'}`);
  out.push('## Export Manifest');
  out.push('');
  out.push(`- **Schema Version:** ${SCHEMA_VERSION}`);
  out.push(`- **Exported By:** ${actorName} (${actorId})`);
  out.push(`- **Export Timestamp:** ${exportedAtIso}`);
  out.push(`- **Course Snapshot Timestamp:** ${updatedAt}`);
  out.push('- **Module Snapshot Timestamps:**');
  if (moduleSnapshotTimestamps.length === 0) {
    out.push('  - *(none)*');
  } else {
    moduleSnapshotTimestamps.forEach((s) => out.push(`  - ${s}`));
  }
  out.push('- **Excluded Data:**');
  out.push('  - Image binary data (referenced by URL only)');
  out.push('  - Video binary data (referenced by URL only)');
  out.push('  - User progress/enrollment records (not part of content)');
  out.push('  - Audit logs (separate concern)');
  out.push('');

  // Collapse multiple blank lines down to one
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of out) {
    const blank = line === '';
    if (blank && prevBlank) continue;
    collapsed.push(line);
    prevBlank = blank;
  }
  const markdown = collapsed.join('\n').replace(/\n+$/, '\n');

  // 7) Filename
  const filename = `${slugify(courseTitle)}_${courseId}_${safeIsoForFilename(exportedAtIso)}.md`;

  // 8) Manifest object
  const manifest: CourseExportManifest = {
    schemaVersion: SCHEMA_VERSION,
    courseId,
    moduleCount,
    blockCount,
    questionCount,
    glossaryTermCount: terms.length,
    exportedAt: exportedAtIso,
    exportedBy: actorId,
  };

  // 9) Audit log (after assembly, before return)
  await auditService.logToFirestore(
    actorId,
    actorName,
    'COURSE_EXPORT',
    courseId,
    `Exported course "${courseTitle}" (${moduleCount} modules, ${blockCount} blocks, ${questionCount} questions, ${terms.length} glossary terms)`,
    stripUndefined({
      schemaVersion: SCHEMA_VERSION,
      moduleCount,
      blockCount,
      questionCount,
      glossaryTermCount: terms.length,
      filename,
    })
  );

  return { filename, markdown, manifest };
}
