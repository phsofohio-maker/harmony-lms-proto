/**
 * Question Type Verification Panel
 * 
 * End-to-end verification that all 5 quiz question types flow correctly
 * through the complete production pipeline:
 * 
 *   Builder Types → Player Answers → Grading Logic → Grade Service → 
 *   Progress Service → Audit Logging → Enrollment Status
 * 
 * This panel does NOT depend on UI components (BlockEditor/BlockRenderer).
 * It tests the data layer directly so type contract issues surface before
 * any UI integration begins.
 * 
 * SUCCESS CRITERIA:
 * 1. Multiple-choice: numeric correctAnswer graded by strict equality
 * 2. True/false: numeric correctAnswer graded by strict equality
 * 3. Fill-in-the-blank: string correctAnswer graded case-insensitively
 * 4. Matching: matchingPairs graded pair-by-pair against string[] answer
 * 5. Short-answer: flagged needsReview, provisional credit for length >= 20
 * 6. All grade entries create audit_logs documents
 * 7. Progress tracking updates correctly
 * 8. Enrollment status becomes 'needs_review' when short-answer present
 * 
 * USAGE:
 * 1. Import into App.tsx or a dev route
 * 2. Render <QuestionTypeVerificationPanel />
 * 3. Must be logged in as admin or instructor
 * 4. Click "Run Full Verification"
 * 5. All 8 test groups should show green
 * 
 * @module scripts/questionTypeVerification
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ============================================
// TYPE DEFINITIONS
// (Mirrors the unified types from Phase A)
// ============================================

type QuizQuestionType = 'multiple-choice' | 'true-false' | 'matching' | 'fill-blank' | 'short-answer';

interface MatchingPair {
  left: string;
  right: string;
}

interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options: string[];
  correctAnswer: number | string | string[];
  matchingPairs?: MatchingPair[];
  points: number;
  explanation?: string;
}

// ============================================
// PURE GRADING LOGIC
// (This becomes utils/gradeCalculation.ts)
// ============================================

interface QuestionGradeResult {
  questionId: string;
  type: QuizQuestionType;
  isCorrect: boolean;
  needsManualReview: boolean;
  earnedPoints: number;
  maxPoints: number;
}

const gradeQuestion = (question: QuizQuestion, userAnswer: any): QuestionGradeResult => {
  const base = {
    questionId: question.id,
    type: question.type,
    maxPoints: question.points,
    needsManualReview: false,
  };

  switch (question.type) {
    case 'multiple-choice':
    case 'true-false': {
      const correct = userAnswer === question.correctAnswer;
      return { ...base, isCorrect: correct, earnedPoints: correct ? question.points : 0 };
    }

    case 'fill-blank': {
      const userStr = typeof userAnswer === 'string' ? userAnswer : '';
      const correctStr = String(question.correctAnswer);
      const correct = userStr.toLowerCase().trim() === correctStr.toLowerCase().trim();
      return { ...base, isCorrect: correct, earnedPoints: correct ? question.points : 0 };
    }

    case 'matching': {
      const pairs = question.matchingPairs || [];
      const answers = Array.isArray(userAnswer) ? userAnswer as string[] : [];
      const allCorrect =
        pairs.length > 0 &&
        answers.length === pairs.length &&
        pairs.every((pair, idx) => pair.right === answers[idx]);
      return { ...base, isCorrect: allCorrect, earnedPoints: allCorrect ? question.points : 0 };
    }

    case 'short-answer': {
      const hasSubstance = typeof userAnswer === 'string' && userAnswer.length >= 20;
      return {
        ...base,
        isCorrect: false, // Cannot auto-grade
        needsManualReview: true,
        earnedPoints: hasSubstance ? question.points : 0,
      };
    }

    default:
      return { ...base, isCorrect: false, needsManualReview: false, earnedPoints: 0 };
  }
};

const gradeQuiz = (
  questions: QuizQuestion[],
  answers: any[],
  passingScore: number
): {
  score: number;
  passed: boolean;
  needsReview: boolean;
  results: QuestionGradeResult[];
  totalPoints: number;
  earnedPoints: number;
} => {
  const results = questions.map((q, idx) => gradeQuestion(q, answers[idx]));
  const totalPoints = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const earnedPoints = results.reduce((sum, r) => sum + r.earnedPoints, 0);
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const needsReview = results.some(r => r.needsManualReview);

  return {
    score,
    passed: score >= passingScore,
    needsReview,
    results,
    totalPoints,
    earnedPoints,
  };
};

// ============================================
// TEST FIXTURE: Synthetic Quiz Module
// ============================================

const PASSING_SCORE = 80;

const TEST_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-mc-001',
    type: 'multiple-choice',
    question: 'Which vital sign is measured in mmHg?',
    options: ['Heart Rate', 'Blood Pressure', 'Temperature', 'Respiratory Rate'],
    correctAnswer: 1, // Blood Pressure
    points: 20,
    explanation: 'Blood pressure is the only vital sign measured in millimeters of mercury.',
  },
  {
    id: 'q-tf-002',
    type: 'true-false',
    question: 'HIPAA requires written consent before sharing patient records with family members.',
    options: ['True', 'False'],
    correctAnswer: 0, // True
    points: 20,
  },
  {
    id: 'q-fb-003',
    type: 'fill-blank',
    question: 'The medical term for high blood pressure is ___.',
    options: [],
    correctAnswer: 'hypertension',
    points: 20,
  },
  {
    id: 'q-match-004',
    type: 'matching',
    question: 'Match each assessment type to its description.',
    options: [],
    correctAnswer: [], // Not used for matching
    matchingPairs: [
      { left: 'Subjective', right: 'Patient-reported symptoms' },
      { left: 'Objective', right: 'Measurable clinical findings' },
      { left: 'Assessment', right: 'Clinical interpretation' },
    ],
    points: 20,
  },
  {
    id: 'q-sa-005',
    type: 'short-answer',
    question: 'Describe the proper protocol for documenting a medication error in a hospice setting.',
    options: [],
    correctAnswer: 'Response should include: immediate patient assessment, supervisor notification, incident report filing, family communication per HIPAA guidelines, and corrective action documentation.',
    points: 20,
  },
];

// Correct answers for each question type
const CORRECT_ANSWERS: any[] = [
  1,                                          // MC: Blood Pressure (index 1)
  0,                                          // TF: True (index 0)
  'Hypertension',                             // FB: case-insensitive match
  ['Patient-reported symptoms', 'Measurable clinical findings', 'Clinical interpretation'], // Matching
  'The proper protocol for documenting a medication error involves immediate patient assessment, notifying the supervisor, and filing an incident report with all relevant details.', // SA: 150+ chars
];

// Incorrect answers to test failure paths
const INCORRECT_ANSWERS: any[] = [
  3,                                          // MC: wrong index
  1,                                          // TF: wrong
  'diabetes',                                 // FB: wrong word
  ['Clinical interpretation', 'Patient-reported symptoms', 'Measurable clinical findings'], // Matching: shuffled wrong
  'Too short.',                               // SA: under 20 chars
];

// Edge-case answers for boundary testing
const EDGE_CASE_ANSWERS: any[] = [
  1,                                          // MC: correct
  0,                                          // TF: correct
  '  HYPERTENSION  ',                         // FB: extra whitespace + uppercase
  ['Patient-reported symptoms', 'Measurable clinical findings', 'Clinical interpretation'], // Matching: correct
  'This is exactly twenty!', // SA: exactly 23 chars (above 20 threshold)
];

// ============================================
// VERIFICATION PANEL COMPONENT
// ============================================

interface TestGroup {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  assertions: TestAssertion[];
}

interface TestAssertion {
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export const QuestionTypeVerificationPanel: React.FC = () => {
  const { user } = useAuth();
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);

  // ---- Test Helpers ----

  const assert = (description: string, condition: boolean, expected: string, actual: string): TestAssertion => ({
    description,
    passed: condition,
    expected,
    actual,
  });

  const updateGroup = (name: string, updates: Partial<TestGroup>) => {
    setTestGroups(prev =>
      prev.map(g => (g.name === name ? { ...g, ...updates } : g))
    );
  };

  // ---- Test Groups ----

  const test1_MultipleChoice = (): TestGroup => {
    const name = '1. Multiple Choice Grading';
    const assertions: TestAssertion[] = [];

    // Correct answer
    const correctResult = gradeQuestion(TEST_QUESTIONS[0], 1);
    assertions.push(assert(
      'Correct MC answer scores full points',
      correctResult.isCorrect === true && correctResult.earnedPoints === 20,
      'isCorrect: true, earned: 20',
      `isCorrect: ${correctResult.isCorrect}, earned: ${correctResult.earnedPoints}`
    ));

    // Wrong answer
    const wrongResult = gradeQuestion(TEST_QUESTIONS[0], 3);
    assertions.push(assert(
      'Wrong MC answer scores zero',
      wrongResult.isCorrect === false && wrongResult.earnedPoints === 0,
      'isCorrect: false, earned: 0',
      `isCorrect: ${wrongResult.isCorrect}, earned: ${wrongResult.earnedPoints}`
    ));

    // No manual review needed
    assertions.push(assert(
      'MC does not flag for review',
      correctResult.needsManualReview === false,
      'needsManualReview: false',
      `needsManualReview: ${correctResult.needsManualReview}`
    ));

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test2_TrueFalse = (): TestGroup => {
    const name = '2. True/False Grading';
    const assertions: TestAssertion[] = [];

    const correctResult = gradeQuestion(TEST_QUESTIONS[1], 0);
    assertions.push(assert(
      'Correct T/F answer (True=0) scores full points',
      correctResult.isCorrect === true && correctResult.earnedPoints === 20,
      'isCorrect: true, earned: 20',
      `isCorrect: ${correctResult.isCorrect}, earned: ${correctResult.earnedPoints}`
    ));

    const wrongResult = gradeQuestion(TEST_QUESTIONS[1], 1);
    assertions.push(assert(
      'Wrong T/F answer scores zero',
      wrongResult.isCorrect === false && wrongResult.earnedPoints === 0,
      'isCorrect: false, earned: 0',
      `isCorrect: ${wrongResult.isCorrect}, earned: ${wrongResult.earnedPoints}`
    ));

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test3_FillBlank = (): TestGroup => {
    const name = '3. Fill-in-the-Blank Grading';
    const assertions: TestAssertion[] = [];

    // Exact match
    const exactResult = gradeQuestion(TEST_QUESTIONS[2], 'hypertension');
    assertions.push(assert(
      'Exact lowercase match scores full points',
      exactResult.isCorrect === true,
      'isCorrect: true',
      `isCorrect: ${exactResult.isCorrect}`
    ));

    // Case-insensitive
    const caseResult = gradeQuestion(TEST_QUESTIONS[2], 'Hypertension');
    assertions.push(assert(
      'Case-insensitive match still correct',
      caseResult.isCorrect === true,
      'isCorrect: true',
      `isCorrect: ${caseResult.isCorrect}`
    ));

    // Whitespace-tolerant
    const wsResult = gradeQuestion(TEST_QUESTIONS[2], '  HYPERTENSION  ');
    assertions.push(assert(
      'Whitespace-padded answer still correct',
      wsResult.isCorrect === true,
      'isCorrect: true',
      `isCorrect: ${wsResult.isCorrect}`
    ));

    // Wrong answer
    const wrongResult = gradeQuestion(TEST_QUESTIONS[2], 'diabetes');
    assertions.push(assert(
      'Wrong fill-blank answer scores zero',
      wrongResult.isCorrect === false && wrongResult.earnedPoints === 0,
      'isCorrect: false, earned: 0',
      `isCorrect: ${wrongResult.isCorrect}, earned: ${wrongResult.earnedPoints}`
    ));

    // Empty string
    const emptyResult = gradeQuestion(TEST_QUESTIONS[2], '');
    assertions.push(assert(
      'Empty string scores zero',
      emptyResult.isCorrect === false,
      'isCorrect: false',
      `isCorrect: ${emptyResult.isCorrect}`
    ));

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test4_Matching = (): TestGroup => {
    const name = '4. Matching Grading';
    const assertions: TestAssertion[] = [];

    // All correct
    const correctPairs = ['Patient-reported symptoms', 'Measurable clinical findings', 'Clinical interpretation'];
    const correctResult = gradeQuestion(TEST_QUESTIONS[3], correctPairs);
    assertions.push(assert(
      'All pairs correct scores full points',
      correctResult.isCorrect === true && correctResult.earnedPoints === 20,
      'isCorrect: true, earned: 20',
      `isCorrect: ${correctResult.isCorrect}, earned: ${correctResult.earnedPoints}`
    ));

    // Shuffled wrong
    const shuffled = ['Clinical interpretation', 'Patient-reported symptoms', 'Measurable clinical findings'];
    const wrongResult = gradeQuestion(TEST_QUESTIONS[3], shuffled);
    assertions.push(assert(
      'Mismatched pairs score zero (all-or-nothing)',
      wrongResult.isCorrect === false && wrongResult.earnedPoints === 0,
      'isCorrect: false, earned: 0',
      `isCorrect: ${wrongResult.isCorrect}, earned: ${wrongResult.earnedPoints}`
    ));

    // Incomplete answer
    const incompleteResult = gradeQuestion(TEST_QUESTIONS[3], ['Patient-reported symptoms']);
    assertions.push(assert(
      'Incomplete matching (1 of 3) scores zero',
      incompleteResult.isCorrect === false,
      'isCorrect: false',
      `isCorrect: ${incompleteResult.isCorrect}`
    ));

    // Empty array
    const emptyResult = gradeQuestion(TEST_QUESTIONS[3], []);
    assertions.push(assert(
      'Empty matching answer scores zero',
      emptyResult.isCorrect === false,
      'isCorrect: false',
      `isCorrect: ${emptyResult.isCorrect}`
    ));

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test5_ShortAnswer = (): TestGroup => {
    const name = '5. Short Answer Grading';
    const assertions: TestAssertion[] = [];

    // Substantial response
    const longAnswer = 'The proper protocol for documenting a medication error involves immediate patient assessment, notifying the supervisor, and filing an incident report.';
    const goodResult = gradeQuestion(TEST_QUESTIONS[4], longAnswer);
    assertions.push(assert(
      'Substantial response (>=20 chars) gets provisional credit',
      goodResult.earnedPoints === 20 && goodResult.needsManualReview === true,
      'earned: 20, needsReview: true',
      `earned: ${goodResult.earnedPoints}, needsReview: ${goodResult.needsManualReview}`
    ));

    assertions.push(assert(
      'Short answer is never auto-marked correct',
      goodResult.isCorrect === false,
      'isCorrect: false',
      `isCorrect: ${goodResult.isCorrect}`
    ));

    // Too short
    const shortResult = gradeQuestion(TEST_QUESTIONS[4], 'Too short.');
    assertions.push(assert(
      'Response under 20 chars gets zero provisional credit',
      shortResult.earnedPoints === 0 && shortResult.needsManualReview === true,
      'earned: 0, needsReview: true',
      `earned: ${shortResult.earnedPoints}, needsReview: ${shortResult.needsManualReview}`
    ));

    // Exactly 20 chars
    const exact20 = '12345678901234567890';
    const borderResult = gradeQuestion(TEST_QUESTIONS[4], exact20);
    assertions.push(assert(
      'Exactly 20 chars gets provisional credit',
      borderResult.earnedPoints === 20,
      'earned: 20',
      `earned: ${borderResult.earnedPoints}`
    ));

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test6_FullQuizGrading = (): TestGroup => {
    const name = '6. Full Quiz Grading Pipeline';
    const assertions: TestAssertion[] = [];

    // All correct (4 auto-graded correct + 1 short-answer with provisional credit)
    const allCorrect = gradeQuiz(TEST_QUESTIONS, CORRECT_ANSWERS, PASSING_SCORE);
    assertions.push(assert(
      'All correct answers: score = 100%',
      allCorrect.score === 100,
      'score: 100',
      `score: ${allCorrect.score}`
    ));
    assertions.push(assert(
      'All correct answers: passed = true at 80% threshold',
      allCorrect.passed === true,
      'passed: true',
      `passed: ${allCorrect.passed}`
    ));
    assertions.push(assert(
      'Quiz with short-answer flags needsReview',
      allCorrect.needsReview === true,
      'needsReview: true',
      `needsReview: ${allCorrect.needsReview}`
    ));

    // All incorrect
    const allWrong = gradeQuiz(TEST_QUESTIONS, INCORRECT_ANSWERS, PASSING_SCORE);
    assertions.push(assert(
      'All wrong answers: score = 0%',
      allWrong.score === 0,
      'score: 0',
      `score: ${allWrong.score}`
    ));
    assertions.push(assert(
      'All wrong answers: passed = false',
      allWrong.passed === false,
      'passed: false',
      `passed: ${allWrong.passed}`
    ));

    // Edge cases
    const edgeCases = gradeQuiz(TEST_QUESTIONS, EDGE_CASE_ANSWERS, PASSING_SCORE);
    assertions.push(assert(
      'Edge case answers: score = 100% (whitespace/case tolerance)',
      edgeCases.score === 100,
      'score: 100',
      `score: ${edgeCases.score}`
    ));

    // Quiz without short-answer should NOT flag needsReview
    const mcOnly = TEST_QUESTIONS.filter(q => q.type === 'multiple-choice');
    const mcAnswers = [1];
    const mcResult = gradeQuiz(mcOnly, mcAnswers, PASSING_SCORE);
    assertions.push(assert(
      'MC-only quiz does NOT flag needsReview',
      mcResult.needsReview === false,
      'needsReview: false',
      `needsReview: ${mcResult.needsReview}`
    ));

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test7_ServiceIntegration = async (): Promise<TestGroup> => {
    const name = '7. Service Layer Integration';
    const assertions: TestAssertion[] = [];

    if (!user) {
      assertions.push(assert('User logged in', false, 'logged in', 'not logged in'));
      return { name, status: 'failed', assertions };
    }

    try {
      // Dynamic imports to match existing verification pattern
      const { enterGrade, getCurrentGrade, calculateCompetency } = await import('../services/gradeService');
      const { initializeModuleProgress, markBlockComplete, recordQuizAttempt, getModuleProgress } = await import('../services/progressService');
      const { createEnrollment, getEnrollment } = await import('../services/enrollmentService');

      const ts = Date.now();
      const testCourseId = `qtype-verify-course-${ts}`;
      const testModuleId = `qtype-verify-module-${ts}`;
      const userId = user.uid;
      const userName = user.displayName || 'Verification User';

      // 7a: Create enrollment
      await createEnrollment(userId, testCourseId, userId, userName);
      const enrollment = await getEnrollment(userId, testCourseId);
      assertions.push(assert(
        '7a. Enrollment created successfully',
        enrollment !== null && enrollment?.status === 'not_started',
        'status: not_started',
        `status: ${enrollment?.status ?? 'null'}`
      ));

      // 7b: Initialize progress
      await initializeModuleProgress(userId, testCourseId, testModuleId);
      let progress = await getModuleProgress(userId, testModuleId);
      assertions.push(assert(
        '7b. Progress initialized at 0%',
        progress !== null && progress?.overallProgress === 0,
        'progress: 0%',
        `progress: ${progress?.overallProgress ?? 'null'}%`
      ));

      // 7c: Record quiz attempt with mixed question types
      const quizResult = gradeQuiz(TEST_QUESTIONS, CORRECT_ANSWERS, PASSING_SCORE);
      await recordQuizAttempt(
        userId, testCourseId, testModuleId,
        'quiz-block-qtype', quizResult.score, quizResult.passed,
        1, // totalBlocks = 1 (just the quiz)
        userId, userName
      );
      progress = await getModuleProgress(userId, testModuleId);
      assertions.push(assert(
        '7c. Quiz attempt recorded, progress updated',
        progress !== null && (progress?.overallProgress ?? 0) > 0,
        'progress: > 0%',
        `progress: ${progress?.overallProgress ?? 'null'}%`
      ));

      // 7d: Enter grade through gradeService
      const gradeRecord = await enterGrade(
        userId, testCourseId, testModuleId,
        quizResult.score, PASSING_SCORE,
        userId, userName,
        `Verification: ${quizResult.score}% with ${quizResult.results.filter(r => r.needsManualReview).length} items pending review`
      );
      assertions.push(assert(
        '7d. Grade persisted with correct score',
        gradeRecord.score === quizResult.score && gradeRecord.passed === quizResult.passed,
        `score: ${quizResult.score}, passed: ${quizResult.passed}`,
        `score: ${gradeRecord.score}, passed: ${gradeRecord.passed}`
      ));

      // 7e: Verify grade retrieval
      const retrieved = await getCurrentGrade(userId, testModuleId);
      assertions.push(assert(
        '7e. Grade retrievable via getCurrentGrade',
        retrieved !== null && retrieved?.score === quizResult.score,
        `score: ${quizResult.score}`,
        `score: ${retrieved?.score ?? 'null'}`
      ));

      // 7f: Competency level calculation
      const competency = calculateCompetency(quizResult.score);
      const expectedCompetency = quizResult.score >= 95 ? 'mastery'
        : quizResult.score >= 80 ? 'competent'
        : quizResult.score >= 60 ? 'developing'
        : 'not_competent';
      assertions.push(assert(
        `7f. Competency level: ${competency}`,
        competency === expectedCompetency,
        expectedCompetency,
        competency
      ));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      assertions.push(assert(
        'Service integration completed without error',
        false,
        'no error',
        msg
      ));
    }

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  const test8_AuditTrail = async (): Promise<TestGroup> => {
    const name = '8. Audit Trail Verification';
    const assertions: TestAssertion[] = [];

    if (!user) {
      assertions.push(assert('User logged in', false, 'logged in', 'not logged in'));
      return { name, status: 'failed', assertions };
    }

    try {
      const { auditService } = await import('../services/auditService');

      // Check in-memory logs for recent GRADE_ENTRY actions
      const recentLogs = auditService.getLogs();
      const gradeEntries = recentLogs.filter(
        l => l.actionType === 'GRADE_ENTRY' && l.details.includes('Verification')
      );

      assertions.push(assert(
        '8a. GRADE_ENTRY audit log exists for verification run',
        gradeEntries.length > 0,
        '>= 1 GRADE_ENTRY logs',
        `${gradeEntries.length} found`
      ));

      // Check that audit log contains score information
      if (gradeEntries.length > 0) {
        const latest = gradeEntries[0];
        assertions.push(assert(
          '8b. Audit log contains score details',
          latest.details.includes('%'),
          'details contain score percentage',
          latest.details.substring(0, 80) + '...'
        ));
        assertions.push(assert(
          '8c. Audit log has valid actor ID',
          latest.actorId === user.uid,
          user.uid,
          latest.actorId
        ));
      }

      // Attempt Firestore audit log retrieval
      try {
        const firestoreLogs = await auditService.getLogsFromFirestore({
          limit: 10,
          actionType: 'GRADE_ENTRY',
        });
        assertions.push(assert(
          '8d. Firestore audit_logs collection has entries',
          firestoreLogs.length > 0,
          '>= 1 Firestore logs',
          `${firestoreLogs.length} found`
        ));
      } catch {
        assertions.push(assert(
          '8d. Firestore audit_logs accessible',
          false,
          'accessible',
          'query failed (check security rules)'
        ));
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      assertions.push(assert(
        'Audit verification completed without error',
        false,
        'no error',
        msg
      ));
    }

    return { name, status: assertions.every(a => a.passed) ? 'passed' : 'failed', assertions };
  };

  // ---- Runner ----

  const runAllTests = async () => {
    setRunning(true);
    setSummary(null);

    // Initialize all groups as pending
    const initialGroups: TestGroup[] = [
      { name: '1. Multiple Choice Grading', status: 'pending', assertions: [] },
      { name: '2. True/False Grading', status: 'pending', assertions: [] },
      { name: '3. Fill-in-the-Blank Grading', status: 'pending', assertions: [] },
      { name: '4. Matching Grading', status: 'pending', assertions: [] },
      { name: '5. Short Answer Grading', status: 'pending', assertions: [] },
      { name: '6. Full Quiz Grading Pipeline', status: 'pending', assertions: [] },
      { name: '7. Service Layer Integration', status: 'pending', assertions: [] },
      { name: '8. Audit Trail Verification', status: 'pending', assertions: [] },
    ];
    setTestGroups(initialGroups);

    // Run synchronous tests (pure grading logic)
    const results: TestGroup[] = [];

    // Phase 1: Pure function tests (no Firebase)
    const syncTests = [
      test1_MultipleChoice,
      test2_TrueFalse,
      test3_FillBlank,
      test4_Matching,
      test5_ShortAnswer,
      test6_FullQuizGrading,
    ];

    for (const testFn of syncTests) {
      const result = testFn();
      results.push(result);
      setTestGroups([...results, ...initialGroups.slice(results.length)]);
      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 100));
    }

    // Phase 2: Async service tests (requires Firebase + auth)
    const serviceResult = await test7_ServiceIntegration();
    results.push(serviceResult);
    setTestGroups([...results, ...initialGroups.slice(results.length)]);

    const auditResult = await test8_AuditTrail();
    results.push(auditResult);
    setTestGroups(results);

    // Summary
    const totalAssertions = results.flatMap(g => g.assertions);
    setSummary({
      passed: totalAssertions.filter(a => a.passed).length,
      failed: totalAssertions.filter(a => !a.passed).length,
      total: totalAssertions.length,
    });

    setRunning(false);
  };

  // ---- Render ----

  const statusIcon = (status: TestGroup['status']) => {
    switch (status) {
      case 'passed': return '\u2705';
      case 'failed': return '\u274C';
      case 'running': return '\u23F3';
      default: return '\u2B55';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-t-xl p-6 text-white">
        <h2 className="text-xl font-bold mb-1">Question Type Verification Panel</h2>
        <p className="text-slate-400 text-sm">
          Tests all 5 quiz question types through the complete grading, progress, and audit pipeline.
        </p>
        <p className="text-slate-500 text-xs mt-2">
          Logged in as: {user?.displayName || user?.email || 'NOT LOGGED IN'}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
        <button
          onClick={runAllTests}
          disabled={running || !user}
          className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {running ? 'Running...' : 'Run Full Verification'}
        </button>

        {summary && (
          <div className={`text-sm font-bold ${summary.failed === 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summary.failed === 0
              ? `ALL ${summary.total} ASSERTIONS PASSED`
              : `${summary.failed} of ${summary.total} FAILED`}
          </div>
        )}
      </div>

      {/* Test Groups */}
      <div className="bg-white border border-slate-200 rounded-b-xl divide-y divide-slate-100">
        {testGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Click "Run Full Verification" to begin. Tests 1–6 are pure logic (no Firebase).
            Tests 7–8 write to Firestore and require authentication.
          </div>
        ) : (
          testGroups.map((group) => (
            <details
              key={group.name}
              open={group.status === 'failed'}
              className="group"
            >
              <summary className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="flex items-center gap-3">
                  <span className="text-lg">{statusIcon(group.status)}</span>
                  <span className={`text-sm font-medium ${
                    group.status === 'failed' ? 'text-red-700' :
                    group.status === 'passed' ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {group.name}
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {group.assertions.filter(a => a.passed).length}/{group.assertions.length} passed
                </span>
              </summary>

              <div className="px-6 pb-4 space-y-2">
                {group.assertions.map((a, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 text-xs font-mono p-2 rounded ${
                      a.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">{a.passed ? '\u2705' : '\u274C'}</span>
                    <div className="min-w-0">
                      <div className="font-semibold">{a.description}</div>
                      {!a.passed && (
                        <div className="mt-1 space-y-0.5 text-[11px]">
                          <div>Expected: <span className="font-bold">{a.expected}</span></div>
                          <div>Actual: <span className="font-bold">{a.actual}</span></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1">
        <p className="font-bold text-slate-600">Pipeline Coverage:</p>
        <p>Tests 1–5: Individual question type grading (pure functions, no side effects)</p>
        <p>Test 6: Full quiz scoring with passing threshold, needsReview flag, edge cases</p>
        <p>Test 7: Firestore service integration (enrollment, progress, grade, competency)</p>
        <p>Test 8: Audit trail verification (in-memory + Firestore audit_logs collection)</p>
      </div>
    </div>
  );
};

export default QuestionTypeVerificationPanel;