/**
 * useCourseGrade Hook
 * 
 * React hook for managing course-level weighted grades
 * Provides real-time grade calculations and persistence
 * 
 * @module hooks/useCourseGrade
 */

import { useState, useEffect } from 'react';
import { CourseGradeCalculation } from '../functions/src/types';
import {
  getCourseGrade,
  calculateAndSaveCourseGrade,
  getUserCourseGrades,
  getCourseGradesForCourse,
} from '../services/courseGradeService';
import { useAuth } from '../contexts/AuthContext';

// ============================================
// SINGLE COURSE GRADE HOOK
// ============================================

interface UseCourseGradeReturn {
  grade: CourseGradeCalculation | null;
  isLoading: boolean;
  error: string | null;
  
  // Computed helpers
  overallScore: number;
  overallPassed: boolean;
  completionPercent: number;
  isComplete: boolean;
  
  // Critical module status
  allCriticalPassed: boolean;
  criticalModulesPassed: number;
  totalCriticalModules: number;
  
  // Actions
  recalculate: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing a single course grade
 * 
 * @param courseId - The course to calculate grade for
 * @param userId - The user to calculate grade for (defaults to current user)
 * @param autoLoad - Whether to load grade on mount (default: true)
 */
export const useCourseGrade = (
  courseId: string | null,
  userId?: string,
  autoLoad: boolean = true
): UseCourseGradeReturn => {
  const { user } = useAuth();
  const targetUserId = userId || user?.uid;
  
  const [grade, setGrade] = useState<CourseGradeCalculation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load grade from Firestore
  const loadGrade = async (forceRecalculate: boolean = false) => {
    if (!targetUserId || !courseId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getCourseGrade(targetUserId, courseId, forceRecalculate);
      setGrade(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load course grade';
      setError(message);
      console.error('Error loading course grade:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto-load on mount if enabled
  useEffect(() => {
    if (!user) return;
    if (autoLoad && targetUserId && courseId) {
      loadGrade(false);
    }
  }, [targetUserId, courseId, autoLoad]);
  
  // Recalculate and save to Firestore
  const recalculate = async () => {
    if (!targetUserId || !courseId || !user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await calculateAndSaveCourseGrade(
        targetUserId,
        courseId,
        user.uid,
        user.displayName || 'Unknown'
      );
      setGrade(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recalculate grade';
      setError(message);
      console.error('Error recalculating grade:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Refresh from saved grade (no recalculation)
  const refresh = async () => {
    await loadGrade(false);
  };
  
  return {
    grade,
    isLoading,
    error,
    
    // Computed values (safe defaults if grade is null)
    overallScore: grade?.overallScore ?? 0,
    overallPassed: grade?.overallPassed ?? false,
    completionPercent: grade?.completionPercent ?? 0,
    isComplete: grade?.isComplete ?? false,
    allCriticalPassed: grade?.allCriticalModulesPassed ?? false,
    criticalModulesPassed: grade?.criticalModulesPassed ?? 0,
    totalCriticalModules: grade?.totalCriticalModules ?? 0,
    
    // Actions
    recalculate,
    refresh,
  };
};

// ============================================
// USER TRANSCRIPT HOOK
// ============================================

interface UseUserTranscriptReturn {
  courseGrades: CourseGradeCalculation[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching all course grades for a user (transcript view)
 * 
 * @param userId - User to fetch grades for (defaults to current user)
 */
export const useUserTranscript = (userId?: string): UseUserTranscriptReturn => {
  const { user } = useAuth();
  const targetUserId = userId || user?.uid;
  
  const [courseGrades, setCourseGrades] = useState<CourseGradeCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadTranscript = async () => {
    if (!targetUserId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const grades = await getUserCourseGrades(targetUserId);
      setCourseGrades(grades);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load transcript';
      setError(message);
      console.error('Error loading transcript:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (targetUserId) {
      loadTranscript();
    }
  }, [targetUserId]);
  
  return {
    courseGrades,
    isLoading,
    error,
    refresh: loadTranscript,
  };
};

// ============================================
// COURSE ROSTER HOOK (Admin)
// ============================================

interface UseCourseRosterReturn {
  studentGrades: CourseGradeCalculation[];
  isLoading: boolean;
  error: string | null;
  
  // Statistics
  totalStudents: number;
  passedStudents: number;
  passRate: number;
  averageScore: number;
  
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching all student grades for a course (admin roster view)
 * 
 * @param courseId - Course to fetch roster for
 */
export const useCourseRoster = (courseId: string | null): UseCourseRosterReturn => {
  const [studentGrades, setStudentGrades] = useState<CourseGradeCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadRoster = async () => {
    if (!courseId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const grades = await getCourseGradesForCourse(courseId);
      setStudentGrades(grades);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load course roster';
      setError(message);
      console.error('Error loading roster:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (courseId) {
      loadRoster();
    }
  }, [courseId]);
  
  // Calculate statistics
  const totalStudents = studentGrades.length;
  const passedStudents = studentGrades.filter(g => g.overallPassed).length;
  const passRate = totalStudents > 0 ? (passedStudents / totalStudents) * 100 : 0;
  const averageScore = totalStudents > 0
    ? studentGrades.reduce((sum, g) => sum + g.overallScore, 0) / totalStudents
    : 0;
  
  return {
    studentGrades,
    isLoading,
    error,
    totalStudents,
    passedStudents,
    passRate: Math.round(passRate),
    averageScore: Math.round(averageScore),
    refresh: loadRoster,
  };
};