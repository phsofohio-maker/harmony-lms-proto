/**
 * Grade Service
 *
 * Handles manual grade entry for legal defensibility.
 * Grades are append-only - corrections create new records, never modify.
 * All operations trigger comprehensive audit logs.
 *
 * PATCHES APPLIED:
 *  1. UTF-8 encoding fix: arrow character in audit message corrected to →
 *  2. Firestore composite index hint: inline comments added for required indexes
 *  3. serverTimestamp() race: enterGrade and correctGrade now build the return
 *     value locally instead of immediately re-reading from Firestore, so the
 *     caller always receives a complete record even before the server timestamp
 *     is resolved.
 *  4. Transaction safety in correctGrade: the two writes (create new grade +
 *     mark original superseded) are now wrapped in a runTransaction so they
 *     are atomic. A failure in either write rolls back both.
 *
 * @module services/gradeService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { Grade } from '../functions/src/types';
import { auditService } from './auditService';

const GRADES_COLLECTION = 'grades';

// ============================================
// TYPES
// ============================================

export interface GradeRecord extends Grade {
  visibleToStudent: boolean;
  supersededBy?: string; // ID of newer grade if this was corrected
  correctionOf?: string; // ID of grade this corrects
  correctionReason?: string;
}

interface GradeDoc {
  userId: string;
  moduleId: string;
  courseId: string;
  score: number;
  passingScore: number;
  passed: boolean;
  gradedBy: string;
  gradedByName: string;
  gradedAt: Timestamp;
  notes: string | null;
  visibleToStudent: boolean;
  supersededBy: string | null;
  correctionOf?: string;
  correctionReason?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate deterministic grade ID for easy lookup.
 * Format: {userId}_{moduleId}_{timestamp}
 */
const generateGradeId = (userId: string, moduleId: string): string => {
  return `${userId}_${moduleId}_${Date.now()}`;
};

const docToGrade = (docSnap: any): GradeRecord => ({
  id: docSnap.id,
  userId: docSnap.data().userId,
  moduleId: docSnap.data().moduleId,
  score: docSnap.data().score,
  passed: docSnap.data().passed,
  gradedBy: docSnap.data().gradedBy,
  // PATCH 3: gradedAt may still be null immediately after a write that used
  // serverTimestamp(). We fall back to an ISO string derived from a local Date
  // so callers always receive a defined string rather than undefined/null.
  gradedAt:
    docSnap.data().gradedAt?.toDate?.()?.toISOString() ??
    new Date().toISOString(),
  notes: docSnap.data().notes,
  visibleToStudent: docSnap.data().visibleToStudent ?? true,
  supersededBy: docSnap.data().supersededBy,
  correctionOf: docSnap.data().correctionOf,
  correctionReason: docSnap.data().correctionReason,
});

/**
 * Build a GradeRecord from local data without a Firestore round-trip.
 * Used after writes to avoid the serverTimestamp() race condition (PATCH 3):
 * Firestore resolves serverTimestamp() server-side, so an immediate getDoc
 * after setDoc can return gradedAt as null. We substitute a local timestamp
 * that is accurate to within a few milliseconds.
 */
const buildLocalGradeRecord = (
  id: string,
  data: Omit<GradeDoc, 'gradedAt'>,
  localTimestamp: Date
): GradeRecord => ({
  id,
  userId: data.userId,
  moduleId: data.moduleId,
  score: data.score,
  passed: data.passed,
  gradedBy: data.gradedBy,
  gradedAt: localTimestamp.toISOString(),
  notes: data.notes,
  visibleToStudent: data.visibleToStudent,
  supersededBy: data.supersededBy ?? undefined,
  correctionOf: data.correctionOf,
  correctionReason: data.correctionReason,
});

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get the current (most recent, non-superseded) grade for a user's module.
 *
 * PATCH 2 — Required Firestore composite index:
 *   Collection : grades
 *   Fields     : userId (ASC), moduleId (ASC), supersededBy (ASC), gradedAt (DESC)
 * Create via Firebase console or firestore.indexes.json.
 */
export const getCurrentGrade = async (
  userId: string,
  moduleId: string
): Promise<GradeRecord | null> => {
  const q = query(
    collection(db, GRADES_COLLECTION),
    where('userId', '==', userId),
    where('moduleId', '==', moduleId),
    where('supersededBy', '==', null),
    orderBy('gradedAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return docToGrade(snapshot.docs[0]);
};

/**
 * Get all grades for a user's module (includes superseded for audit trail).
 *
 * PATCH 2 — Required Firestore composite index:
 *   Collection : grades
 *   Fields     : userId (ASC), moduleId (ASC), gradedAt (DESC)
 */
export const getGradeHistory = async (
  userId: string,
  moduleId: string
): Promise<GradeRecord[]> => {
  const q = query(
    collection(db, GRADES_COLLECTION),
    where('userId', '==', userId),
    where('moduleId', '==', moduleId),
    orderBy('gradedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToGrade);
};

/**
 * Get all current grades for a user (across all modules).
 *
 * PATCH 2 — Required Firestore composite index:
 *   Collection : grades
 *   Fields     : userId (ASC), supersededBy (ASC), gradedAt (DESC)
 */
export const getUserGrades = async (userId: string): Promise<GradeRecord[]> => {
  const q = query(
    collection(db, GRADES_COLLECTION),
    where('userId', '==', userId),
    where('supersededBy', '==', null),
    orderBy('gradedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToGrade);
};

/**
 * Get all grades for a module (admin view — all students).
 *
 * PATCH 2 — Required Firestore composite index:
 *   Collection : grades
 *   Fields     : moduleId (ASC), supersededBy (ASC), gradedAt (DESC)
 */
export const getModuleGrades = async (moduleId: string): Promise<GradeRecord[]> => {
  const q = query(
    collection(db, GRADES_COLLECTION),
    where('moduleId', '==', moduleId),
    where('supersededBy', '==', null),
    orderBy('gradedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToGrade);
};

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Enter a new grade (manual entry by instructor).
 * This is the primary grading action for legal defensibility.
 *
 * PATCH 3: Returns a locally-constructed GradeRecord instead of immediately
 * re-reading from Firestore, avoiding the serverTimestamp() race condition.
 */
export const enterGrade = async (
  userId: string,
  courseId: string,
  moduleId: string,
  score: number,
  passingScore: number,
  graderId: string,
  graderName: string,
  notes?: string
): Promise<GradeRecord> => {
  const gradeId = generateGradeId(userId, moduleId);
  const docRef = doc(db, GRADES_COLLECTION, gradeId);
  const localTimestamp = new Date(); // captured before the write

  // Clamp score to 0–100
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const passed = clampedScore >= passingScore;

  const gradeData: GradeDoc = {
    userId,
    moduleId,
    courseId,
    score: clampedScore,
    passingScore,
    passed,
    gradedBy: graderId,
    gradedByName: graderName,
    gradedAt: serverTimestamp() as Timestamp,
    notes: notes ?? null,
    visibleToStudent: true,
    supersededBy: null,
  };

  await setDoc(docRef, gradeData);

  // Comprehensive audit log for legal defensibility
  // PATCH 1: Arrow character verified as literal → (U+2192), not a mojibake sequence.
  await auditService.logToFirestore(
    graderId,
    graderName,
    'GRADE_ENTRY',
    gradeId,
    `Entered grade: ${clampedScore}% (${passed ? 'PASSED' : 'FAILED'}) for user ${userId} on module ${moduleId}${notes ? ` - Notes: ${notes}` : ''}`
  );

  // PATCH 3: Build return value locally — no immediate getDoc required.
  return buildLocalGradeRecord(gradeId, { ...gradeData }, localTimestamp);
};

/**
 * Correct an existing grade (creates new record, marks old as superseded).
 * This preserves the full audit trail while allowing corrections.
 *
 * PATCH 4: The two Firestore writes (create corrected grade + mark original
 * superseded) are now inside a runTransaction, making them atomic. If either
 * write fails, both are rolled back — preventing a state where two grades
 * appear current simultaneously.
 *
 * PATCH 3: Returns a locally-constructed GradeRecord to avoid the
 * serverTimestamp() race condition on the immediate post-write read.
 */
export const correctGrade = async (
  originalGradeId: string,
  newScore: number,
  passingScore: number,
  correctionReason: string,
  graderId: string,
  graderName: string,
  notes?: string
): Promise<GradeRecord> => {
  const originalRef = doc(db, GRADES_COLLECTION, originalGradeId);
  const localTimestamp = new Date(); // captured before the transaction

  const clampedScore = Math.max(0, Math.min(100, Math.round(newScore)));

  // PATCH 4: Wrap both writes in a transaction.
  // runTransaction retries automatically on contention (up to 5 times).
  const { newGradeId, newGradeData } = await runTransaction(db, async (tx) => {
    // Read inside the transaction so Firestore can detect concurrent writes.
    const originalSnap = await tx.get(originalRef);

    if (!originalSnap.exists()) {
      throw new Error('Original grade not found');
    }

    const originalData = originalSnap.data() as GradeDoc;

    if (originalData.supersededBy) {
      throw new Error(
        'Cannot correct an already-superseded grade. Correct the most recent grade instead.'
      );
    }

    const passed = clampedScore >= passingScore;
    const newId = generateGradeId(originalData.userId, originalData.moduleId);
    const newRef = doc(db, GRADES_COLLECTION, newId);

    const correctedData: GradeDoc = {
      userId: originalData.userId,
      moduleId: originalData.moduleId,
      courseId: originalData.courseId,
      score: clampedScore,
      passingScore,
      passed,
      gradedBy: graderId,
      gradedByName: graderName,
      gradedAt: serverTimestamp() as Timestamp,
      notes: notes ?? null,
      visibleToStudent: true,
      correctionOf: originalGradeId,
      correctionReason,
      supersededBy: null,
    };

    // Atomic write 1: create the corrected grade
    tx.set(newRef, correctedData);

    // Atomic write 2: mark original as superseded (never deleted)
    tx.set(originalRef, { supersededBy: newId }, { merge: true });

    return { newGradeId: newId, newGradeData: correctedData, originalData };
  });

  // Audit log is outside the transaction intentionally — audit failures should
  // not roll back a successful grade correction. Log the event best-effort.
  // PATCH 1: Arrow character verified as literal → (U+2192).
  await auditService.logToFirestore(
    graderId,
    graderName,
    'GRADE_CHANGE',
    newGradeId,
    `Grade correction: ${newGradeData.correctionOf} → ${clampedScore}% for user ${newGradeData.userId}. Reason: ${correctionReason}`
  ).catch((err) => {
    // Log to console but do not rethrow — grade is already safely committed.
    console.error('[gradeService] Audit log failed after correctGrade:', err);
  });

  // PATCH 3: Build return value locally — no immediate getDoc required.
  return buildLocalGradeRecord(newGradeId, { ...newGradeData }, localTimestamp);
};

/**
 * Hide a grade from student view (admin action).
 * Grade still exists for audit purposes, just not shown to the student.
 */
export const setGradeVisibility = async (
  gradeId: string,
  visible: boolean,
  actorId: string,
  actorName: string
): Promise<void> => {
  const docRef = doc(db, GRADES_COLLECTION, gradeId);

  await setDoc(docRef, { visibleToStudent: visible }, { merge: true });

  await auditService.logToFirestore(
    actorId,
    actorName,
    'GRADE_CHANGE',
    gradeId,
    `Grade visibility set to: ${visible ? 'visible' : 'hidden'}`
  );
};

// ============================================
// AGGREGATE OPERATIONS
// ============================================

/**
 * Calculate competency level based on score.
 */
export type CompetencyLevel = 'not_competent' | 'developing' | 'competent' | 'mastery';

export const calculateCompetency = (score: number): CompetencyLevel => {
  if (score >= 95) return 'mastery';
  if (score >= 80) return 'competent';
  if (score >= 60) return 'developing';
  return 'not_competent';
};

/**
 * Get a user's competency summary across all graded modules.
 */
export const getUserCompetencySummary = async (
  userId: string
): Promise<{
  totalGraded: number;
  passed: number;
  failed: number;
  averageScore: number;
  competencyBreakdown: Record<CompetencyLevel, number>;
}> => {
  const grades = await getUserGrades(userId);

  const summary = {
    totalGraded: grades.length,
    passed: grades.filter((g) => g.passed).length,
    failed: grades.filter((g) => !g.passed).length,
    averageScore: 0,
    competencyBreakdown: {
      mastery: 0,
      competent: 0,
      developing: 0,
      not_competent: 0,
    } as Record<CompetencyLevel, number>,
  };

  if (grades.length > 0) {
    summary.averageScore = Math.round(
      grades.reduce((sum, g) => sum + g.score, 0) / grades.length
    );

    grades.forEach((g) => {
      const level = calculateCompetency(g.score);
      summary.competencyBreakdown[level]++;
    });
  }

  return summary;
};