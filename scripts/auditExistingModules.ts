/**
 * Existing-module audit sweep (Guide 14).
 *
 * Runs the deterministic validator against every module currently in
 * Firestore and writes a triage report to disk. Read-only: never mutates
 * Firestore. Use the resulting JSON to decide which modules to fix, which
 * to unpublish, and whether the gate is safe to enable without a content
 * sprint first.
 *
 * Usage:
 *   npx tsx --tsconfig scripts/seed/tsconfig.json scripts/auditExistingModules.ts
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or service-account.json in repo root.
 *
 * @module scripts/auditExistingModules
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initAdmin } from './seed/seedAll';
import { runValidation } from '../services/moduleValidation/validator';
import type {
  ValidationIssue,
  ValidatorGlossaryTerm,
  ValidationReport,
} from '../services/moduleValidation/types';
import type { Module, Course } from '../functions/src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ModuleAuditEntry {
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  status: string;
  summary: ValidationReport['summary'];
  issues: ValidationIssue[];
}

interface AuditReport {
  generatedAt: string;
  validatorVersion: string;
  totalCourses: number;
  totalModules: number;
  modulesWithBlocking: number;
  modulesWithAdvisory: number;
  cleanModules: number;
  modules: ModuleAuditEntry[];
}

async function loadCourse(
  db: admin.firestore.Firestore,
  courseId: string
): Promise<Course | null> {
  const snap = await db.collection('courses').doc(courseId).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    title: d.title ?? '',
    description: d.description ?? '',
    category: d.category ?? 'compliance',
    ceCredits: d.ceCredits ?? 0,
    thumbnailUrl: d.thumbnailUrl ?? '',
    status: d.status,
    modules: [],
    estimatedHours: d.estimatedHours ?? 0,
    availability: d.availability,
    certificateTemplateDocId: d.certificateTemplateDocId,
  };
}

async function loadModule(
  db: admin.firestore.Firestore,
  courseId: string,
  moduleDoc: admin.firestore.QueryDocumentSnapshot
): Promise<Module> {
  const data = moduleDoc.data();
  const blocksSnap = await moduleDoc.ref.collection('blocks').orderBy('order').get();
  const blocks = blocksSnap.docs.map(d => ({ id: d.id, ...(d.data() as object) }));
  return {
    id: moduleDoc.id,
    courseId,
    title: data.title ?? '',
    description: data.description ?? '',
    status: data.status ?? 'draft',
    passingScore: data.passingScore ?? 0,
    estimatedMinutes: data.estimatedMinutes ?? 0,
    order: data.order,
    blocks: blocks as Module['blocks'],
    weight: data.weight ?? 0,
    isCritical: !!data.isCritical,
    availability: data.availability,
  };
}

async function loadGlossary(
  db: admin.firestore.Firestore,
  courseId: string
): Promise<ValidatorGlossaryTerm[]> {
  try {
    const snap = await db.collection('glossary').doc(courseId).collection('terms').get();
    return snap.docs.map(d => ({
      id: d.id,
      term: (d.data() as { term?: string }).term ?? '',
    }));
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  console.log('Module Content Audit Sweep — Guide 14');
  console.log('--------------------------------------');

  initAdmin();
  const db = admin.firestore();

  const coursesSnap = await db.collection('courses').get();
  console.log(`Loaded ${coursesSnap.size} course(s).`);

  const entries: ModuleAuditEntry[] = [];

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const course = await loadCourse(db, courseId);
    if (!course) continue;
    const glossaryTerms = await loadGlossary(db, courseId);

    const modulesSnap = await courseDoc.ref.collection('modules').get();
    if (modulesSnap.empty) {
      console.log(`  ${course.title || courseId}: no modules.`);
      continue;
    }

    for (const modDoc of modulesSnap.docs) {
      try {
        const module = await loadModule(db, courseId, modDoc);
        const report = runValidation(module, { course, glossaryTerms });
        entries.push({
          courseId,
          courseTitle: course.title,
          moduleId: module.id,
          moduleTitle: module.title,
          status: module.status,
          summary: report.summary,
          issues: report.issues,
        });
      } catch (err) {
        console.error(`  Failed to validate module ${modDoc.id}:`, err);
      }
    }
  }

  // Stable sort: courseId, then moduleId — keeps diffs across runs minimal.
  entries.sort((a, b) =>
    a.courseId === b.courseId
      ? a.moduleId.localeCompare(b.moduleId)
      : a.courseId.localeCompare(b.courseId)
  );

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    validatorVersion: '1.0.0',
    totalCourses: coursesSnap.size,
    totalModules: entries.length,
    modulesWithBlocking: entries.filter(e => e.summary.blocking > 0).length,
    modulesWithAdvisory: entries.filter(e => e.summary.advisory > 0).length,
    cleanModules: entries.filter(
      e => e.summary.blocking === 0 && e.summary.advisory === 0
    ).length,
    modules: entries,
  };

  const outDir = path.resolve(__dirname, '..');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `module-audit-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log('Summary');
  console.log(`  Courses scanned:       ${report.totalCourses}`);
  console.log(`  Modules scanned:       ${report.totalModules}`);
  console.log(`  Blocking issues in:    ${report.modulesWithBlocking} module(s)`);
  console.log(`  Advisory warnings in:  ${report.modulesWithAdvisory} module(s)`);
  console.log(`  Clean modules:         ${report.cleanModules}`);
  console.log('');
  console.log(`Report written to: ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Audit sweep failed:', err);
    process.exit(1);
  });
