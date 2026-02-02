/**
 * Grade Service
 * 
 * Handles manual grade entry for legal defensibility.
 * Grades are append-only - corrections create new records, never modify.
 * All operations trigger comprehensive audit logs.
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
  } from 'firebase/firestore';
  import { db } from './firebase';
  import { Grade } from '../types';
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
    passed: boolean;
    gradedBy: string;
    gradedByName: string;
    gradedAt: Timestamp;
    notes?: string;
    visibleToStudent: boolean;
    supersededBy?: string;
    correctionOf?: string;
    correctionReason?: string;
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  /**
   * Generate deterministic grade ID for easy lookup
   * Format: {userId}_{moduleId}_{timestamp}
   */
  const generateGradeId = (userId: string, moduleId: string): string => {
    return `${userId}_${moduleId}_${Date.now()}`;
  };
  
  const docToGrade = (doc: any): GradeRecord => ({
    id: doc.id,
    userId: doc.data().userId,
    moduleId: doc.data().moduleId,
    score: doc.data().score,
    passed: doc.data().passed,
    gradedBy: doc.data().gradedBy,
    gradedAt: doc.data().gradedAt?.toDate?.()?.toISOString(),
    notes: doc.data().notes,
    visibleToStudent: doc.data().visibleToStudent ?? true,
    supersededBy: doc.data().supersededBy,
    correctionOf: doc.data().correctionOf,
    correctionReason: doc.data().correctionReason,
  });
  
  // ============================================
  // READ OPERATIONS
  // ============================================
  
  /**
   * Get the current (most recent, non-superseded) grade for a user's module
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
   * Get all grades for a user's module (includes superseded for audit trail)
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
   * Get all current grades for a user (across all modules)
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
   * Get all grades for a module (admin view - all students)
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
   * Enter a new grade (manual entry by instructor)
   * This is the primary grading action for legal defensibility
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
    
    // Clamp score to 0-100
    const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
    const passed = clampedScore >= passingScore;
    
    const gradeData: GradeDoc = {
      userId,
      moduleId,
      courseId,
      score: clampedScore,
      passed,
      gradedBy: graderId,
      gradedByName: graderName,
      gradedAt: serverTimestamp() as Timestamp,
      notes: notes || undefined,
      visibleToStudent: true,
      supersededBy: undefined,
    };
    
    await setDoc(docRef, gradeData);
    
    // Comprehensive audit log for legal defensibility
    await auditService.logToFirestore(
      graderId,
      graderName,
      'GRADE_ENTRY',
      gradeId,
      `Entered grade: ${clampedScore}% (${passed ? 'PASSED' : 'FAILED'}) for user ${userId} on module ${moduleId}${notes ? ` - Notes: ${notes}` : ''}`
    );
    
    // Return the created grade
    const created = await getDoc(docRef);
    return docToGrade(created);
  };
  
  /**
   * Correct an existing grade (creates new record, marks old as superseded)
   * This preserves the full audit trail while allowing corrections
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
    // Get the original grade
    const originalRef = doc(db, GRADES_COLLECTION, originalGradeId);
    const originalSnap = await getDoc(originalRef);
    
    if (!originalSnap.exists()) {
      throw new Error('Original grade not found');
    }
    
    const originalData = originalSnap.data() as GradeDoc;
    
    if (originalData.supersededBy) {
      throw new Error('Cannot correct an already-superseded grade. Correct the most recent grade instead.');
    }
    
    // Create the new corrected grade
    const newGradeId = generateGradeId(originalData.userId, originalData.moduleId);
    const newDocRef = doc(db, GRADES_COLLECTION, newGradeId);
    
    const clampedScore = Math.max(0, Math.min(100, Math.round(newScore)));
    const passed = clampedScore >= passingScore;
    
    const newGradeData: GradeDoc = {
      userId: originalData.userId,
      moduleId: originalData.moduleId,
      courseId: originalData.courseId,
      score: clampedScore,
      passed,
      gradedBy: graderId,
      gradedByName: graderName,
      gradedAt: serverTimestamp() as Timestamp,
      notes: notes || undefined,
      visibleToStudent: true,
      correctionOf: originalGradeId,
      correctionReason,
    };
    
    await setDoc(newDocRef, newGradeData);
    
    // Mark original as superseded (but never delete it)
    await setDoc(originalRef, { supersededBy: newGradeId }, { merge: true });
    
    // Audit log for the correction
    await auditService.logToFirestore(
      graderId,
      graderName,
      'GRADE_CHANGE',
      newGradeId,
      `Grade correction: ${originalData.score}% → ${clampedScore}% for user ${originalData.userId}. Reason: ${correctionReason}`
    );
    
    const created = await getDoc(newDocRef);
    return docToGrade(created);
  };
  
  /**
   * Hide a grade from student view (admin action)
   * Grade still exists for audit, just not shown to student
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
   * Calculate competency level based on grade
   */
  export type CompetencyLevel = 'not_competent' | 'developing' | 'competent' | 'mastery';
  
  export const calculateCompetency = (score: number): CompetencyLevel => {
    if (score >= 95) return 'mastery';
    if (score >= 80) return 'competent';
    if (score >= 60) return 'developing';
    return 'not_competent';
  };
  
  /**
   * Get a user's competency summary across all graded modules
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
      passed: grades.filter(g => g.passed).length,
      failed: grades.filter(g => !g.passed).length,
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
      
      grades.forEach(g => {
        const level = calculateCompetency(g.score);
        summary.competencyBreakdown[level]++;
      });
    }
    
    return summary;
  };