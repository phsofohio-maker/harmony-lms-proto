/**
 * Smoke test for the Guide 14 validator.
 *
 * Runs the validator against a clean fixture and a designed-to-fail fixture,
 * then prints the issue list. Pure offline check — no Firestore, no auth.
 *
 * Usage:
 *   npx tsx --tsconfig scripts/seed/tsconfig.json scripts/smokeValidator.ts
 */

import { runValidation } from '../services/moduleValidation/validator';
import type { Module, Course, ContentBlock } from '../functions/src/types';

const course: Course = {
  id: 'c1',
  title: 'Test Course',
  description: 'desc',
  category: 'compliance',
  ceCredits: 4,
  thumbnailUrl: '',
  status: 'draft',
  modules: [],
  estimatedHours: 1,
};

const cleanModule: Module = {
  id: 'm-clean',
  courseId: 'c1',
  title: 'Hand Hygiene',
  description: 'How and why to wash hands.',
  status: 'draft',
  passingScore: 80,
  estimatedMinutes: 10,
  blocks: [
    {
      id: 'b1',
      moduleId: 'm-clean',
      type: 'text',
      order: 1,
      required: true,
      data: {
        content:
          '<p>Wash your hands for at least 20 seconds with soap and warm water before patient contact.</p>',
      },
    } as ContentBlock,
    {
      id: 'b2',
      moduleId: 'm-clean',
      type: 'quiz',
      order: 2,
      required: true,
      data: {
        title: 'Quiz',
        passingScore: 80,
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'How long should you wash your hands?',
            options: ['5 seconds', '20 seconds', '60 seconds'],
            correctAnswer: 1,
            points: 1,
            explanation: 'CDC recommends 20 seconds.',
          },
        ],
      },
    } as ContentBlock,
  ],
  weight: 1,
  isCritical: false,
};

const dirtyModule: Module = {
  id: 'm-dirty',
  courseId: 'c1',
  title: 'Bad Module ⭐',
  description: '',
  status: 'draft',
  passingScore: 80,
  estimatedMinutes: 0, // missing duration on CE course
  isCritical: true,
  weight: 1,
  blocks: [
    {
      id: 'qbad',
      moduleId: 'm-dirty',
      type: 'quiz',
      order: 1,
      required: true,
      data: {
        title: 'Quiz',
        passingScore: 80,
        questions: [
          {
            id: 'qd1',
            type: 'multiple-choice',
            question: 'Pick one',
            options: ['a. a. Stop what you are doing', '', 'a. a. Stop what you are doing'], // letter prefix + empty + duplicate
            correctAnswer: 1, // points to empty option
            points: 1,
          },
          {
            id: 'qd2',
            type: 'true-false',
            question: 'TF1',
            options: ['true', 'false'],
            correctAnswer: 0,
            points: 1,
          },
          {
            id: 'qd3',
            type: 'true-false',
            question: 'TF2',
            options: ['true', 'false'],
            correctAnswer: 0,
            points: 1,
          },
          {
            id: 'qd4',
            type: 'true-false',
            question: 'TF3',
            options: ['true', 'false'],
            correctAnswer: 0,
            points: 1,
          },
          {
            id: 'qd5',
            type: 'true-false',
            question: 'TF4',
            options: ['true', 'false'],
            correctAnswer: 0,
            points: 1,
          },
        ],
      },
    } as ContentBlock,
  ],
};

function summarize(label: string, m: Module): void {
  const report = runValidation(m, { course, glossaryTerms: [] });
  console.log(`\n== ${label} ==`);
  console.log(`Summary:`, report.summary);
  for (const i of report.issues) {
    console.log(`  [${i.severity}] ${i.checkId} — ${i.message}`);
  }
}

summarize('Clean module (expected: 0 blocking)', cleanModule);
summarize('Dirty module (expected: blocking ZERO_CONTENT_BLOCKS, EMOJI, EMPTY_CORRECT_OPTION, DUPLICATE; advisories: letter prefix, T/F imbalance, missing duration, missing explanations)', dirtyModule);
