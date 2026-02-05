/**
 * Course Grade Service
 * 
 * Calculates weighted course grades from individual module grades.
 * Enforces critical module requirements for legal defensibility.
 * 
 * Design Principles:
 * - Single Source of Truth: Module grades are authoritative
 * - Explicit Calculation: No hidden scoring logic
 * - Audit Trail: Every calculation is logged
 * 
 * @module services/courseGradeService
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  CourseGradeCalculation, 
  CourseGradeDoc, 
  ModuleScore,
  Module,
} from '../functions/src/types';
import { auditService } from './auditService';
import { getModules } from './courseService';
import { getCurrentGrade, type GradeRecord } from './gradeService';

// Firestore collection
const COURSE_GRADES_COLLECTION = 'course_grades';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generates deterministic ID for course grade document
 */
const getCourseGradeId = (userId: string, courseId: string): string => {
  return `${userId}_${courseId}`;
};

/**
 * Converts Firestore document to CourseGradeCalculation
 */
const docToCourseGrade = (doc: any): CourseGradeCalculation => ({
  courseId: doc.data().courseId,
  userId: doc.data().userId,
  overallScore: doc.data().overallScore,
  overallPassed: doc.data().overallPassed,
  totalCriticalModules: doc.data().totalCriticalModules,
  criticalModulesPassed: doc.data().criticalModulesPassed,
  allCriticalModulesPassed: doc.data().allCriticalModulesPassed,
  moduleBreakdown: doc.data().moduleBreakdown,
  totalModules: doc.data().totalModules,
  gradedModules: doc.data().gradedModules,
  completionPercent: doc.data().completionPercent,
  isComplete: doc.data().isComplete,
  calculatedAt: doc.data().calculatedAt?.toDate()?.toISOString() || new Date().toISOString(),
});

// ============================================
// VALIDATION
// ============================================

/**
 * Validates that module weights sum to 100
 * Throws error if validation fails
 */
const validateModuleWeights = (modules: Module[]): void => {
  const totalWeight = modules.reduce((sum, m) => sum + (m.weight || 0), 0);
  
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(
      `Module weights must sum to 100. Current total: ${totalWeight}. ` +
      `Check course configuration.`
    );
  }
};

// ============================================
// CORE CALCULATION LOGIC
// ============================================

/**
 * Calculates weighted course grade from individual module grades
 * 
 * Algorithm:
 * 1. Fetch all modules for the course
 * 2. Fetch all grades for the user
 * 3. For each module:
 *    - If graded: weightedScore = (score * weight / 100)
 *    - If not graded: weightedScore = 0 (counts against overall)
 * 4. Overall score = sum of all weighted scores
 * 5. Check critical module requirements
 * 6. Determine pass/fail
 */
export const calculateCourseGrade = async (
  userId: string,
  courseId: string
): Promise<CourseGradeCalculation> => {
  // Fetch all modules for this course
  const modules = await getModules(courseId);
  
  if (modules.length === 0) {
    throw new Error(`No modules found for course ${courseId}`);
  }
  
  // Validate weights
  validateModuleWeights(modules);
  
  // Build module breakdown with grades
  const moduleBreakdown: ModuleScore[] = [];
  let totalWeightedScore = 0;
  let gradedModules = 0;
  let totalCriticalModules = 0;
  let criticalModulesPassed = 0;
  
  for (const module of modules) {
    // Fetch grade for this module
    const grade = await getCurrentGrade(userId, module.id);
    
    const score = grade?.score ?? null;
    const passed = grade?.passed ?? null;
    const weight = module.weight || 0;
    const weightedScore = score !== null ? (score * weight / 100) : null;
    
    // Track critical modules
    if (module.isCritical) {
      totalCriticalModules++;
      if (passed === true) {
        criticalModulesPassed++;
      }
    }
    
    // Add to breakdown
    moduleBreakdown.push({
      moduleId: module.id,
      moduleTitle: module.title,
      score,
      weight,
      weightedScore,
      isCritical: module.isCritical || false,
      passed,
      passingScore: module.passingScore || 70,
    });
    
    // Accumulate weighted score (treat null as 0)
    totalWeightedScore += weightedScore || 0;
    
    if (grade) {
      gradedModules++;
    }
  }
  
  // Calculate overall metrics
  const overallScore = Math.round(totalWeightedScore);
  const allCriticalModulesPassed = criticalModulesPassed === totalCriticalModules;
  const completionPercent = Math.round((gradedModules / modules.length) * 100);
  const isComplete = gradedModules === modules.length;
  
  // Determine pass/fail
  // Student must:
  // 1. Pass all critical modules AND
  // 2. Achieve minimum overall score (70%)
  const overallPassed = allCriticalModulesPassed && overallScore >= 70;
  
  return {
    courseId,
    userId,
    overallScore,
    overallPassed,
    totalCriticalModules,
    criticalModulesPassed,
    allCriticalModulesPassed,
    moduleBreakdown,
    totalModules: modules.length,
    gradedModules,
    completionPercent,
    isComplete,
    calculatedAt: new Date().toISOString(),
  };
};

// ============================================
// PERSISTENCE
// ============================================

/**
 * Calculates and persists course grade to Firestore
 * Creates audit trail for legal defensibility
 */
export const calculateAndSaveCourseGrade = async (
  userId: string,
  courseId: string,
  actorId: string,
  actorName: string
): Promise<CourseGradeCalculation> => {
  const calculation = await calculateCourseGrade(userId, courseId);
  
  const docId = getCourseGradeId(userId, courseId);
  const docRef = doc(db, COURSE_GRADES_COLLECTION, docId);
  
  const docData: Omit<CourseGradeDoc, 'calculatedAt' | 'updatedAt'> = {
    userId: calculation.userId,
    courseId: calculation.courseId,
    overallScore: calculation.overallScore,
    overallPassed: calculation.overallPassed,
    criticalModulesPassed: calculation.criticalModulesPassed,
    totalCriticalModules: calculation.totalCriticalModules,
    allCriticalModulesPassed: calculation.allCriticalModulesPassed,
    moduleBreakdown: calculation.moduleBreakdown,
    totalModules: calculation.totalModules,
    gradedModules: calculation.gradedModules,
    completionPercent: calculation.completionPercent,
    isComplete: calculation.isComplete,
  };
  
  await setDoc(docRef, {
    ...docData,
    calculatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // Audit log
  await auditService.logToFirestore(
    actorId,
    actorName,
    'COURSE_UPDATE',
    docId,
    `Calculated course grade: ${calculation.overallScore}% (${calculation.overallPassed ? 'PASSED' : 'FAILED'}) - ` +
    `Critical modules: ${calculation.criticalModulesPassed}/${calculation.totalCriticalModules}`
  );
  
  return calculation;
};

/**
 * Retrieves saved course grade from Firestore
 */
export const getSavedCourseGrade = async (
  userId: string,
  courseId: string
): Promise<CourseGradeCalculation | null> => {
  const docId = getCourseGradeId(userId, courseId);
  const docRef = doc(db, COURSE_GRADES_COLLECTION, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return docToCourseGrade(docSnap);
};

/**
 * Gets course grade, calculating if not saved or recalculating if requested
 */
export const getCourseGrade = async (
  userId: string,
  courseId: string,
  forceRecalculate: boolean = false
): Promise<CourseGradeCalculation> => {
  if (!forceRecalculate) {
    const saved = await getSavedCourseGrade(userId, courseId);
    if (saved) return saved;
  }
  
  // Calculate fresh
  return await calculateCourseGrade(userId, courseId);
};

// ============================================
// ADMIN QUERIES
// ============================================

/**
 * Get all course grades for a specific course (admin view)
 */
export const getCourseGradesForCourse = async (
  courseId: string
): Promise<CourseGradeCalculation[]> => {
  const q = query(
    collection(db, COURSE_GRADES_COLLECTION),
    where('courseId', '==', courseId),
    orderBy('overallScore', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToCourseGrade);
};

/**
 * Get all course grades for a user (student transcript view)
 */
export const getUserCourseGrades = async (
  userId: string
): Promise<CourseGradeCalculation[]> => {
  const q = query(
    collection(db, COURSE_GRADES_COLLECTION),
    where('userId', '==', userId),
    orderBy('calculatedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToCourseGrade);
};