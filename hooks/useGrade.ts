/**
 * useGrade Hook
 * 
 * Provides grade data and manual grade entry for instructors.
 * Supports grade corrections with full audit trail.
 * 
 * @module hooks/useGrade
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GradeRecord,
  CompetencyLevel,
  getCurrentGrade,
  getGradeHistory,
  getUserGrades,
  enterGrade,
  correctGrade,
  calculateCompetency,
  getUserCompetencySummary,
} from '../services/gradeService';
import { useAuth } from '../contexts/AuthContext';

// ============================================
// SINGLE MODULE GRADE HOOK
// ============================================

interface UseModuleGradeReturn {
  grade: GradeRecord | null;
  gradeHistory: GradeRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Computed
  competencyLevel: CompetencyLevel | null;
  isPassed: boolean;
  
  // Actions (instructor only)
  enterNewGrade: (score: number, passingScore: number, notes?: string) => Promise<boolean>;
  correctCurrentGrade: (newScore: number, passingScore: number, reason: string, notes?: string) => Promise<boolean>;
  
  refetch: () => Promise<void>;
}

export const useModuleGrade = (
  studentId: string,
  courseId: string,
  moduleId: string
): UseModuleGradeReturn => {
  const { user } = useAuth();
  const [grade, setGrade] = useState<GradeRecord | null>(null);
  const [gradeHistory, setGradeHistory] = useState<GradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrade = useCallback(async () => {
    if (!studentId || !moduleId) {
      setGrade(null);
      setGradeHistory([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [currentGrade, history] = await Promise.all([
        getCurrentGrade(studentId, moduleId),
        getGradeHistory(studentId, moduleId),
      ]);
      
      setGrade(currentGrade);
      setGradeHistory(history);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load grade';
      setError(message);
      console.error('useModuleGrade fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, moduleId]);

  useEffect(() => {
    fetchGrade();
  }, [fetchGrade]);

  const enterNewGrade = useCallback(async (
    score: number,
    passingScore: number,
    notes?: string
  ): Promise<boolean> => {
    if (!user?.uid) {
      setError('Must be logged in to enter grades');
      return false;
    }
    
    try {
      const newGrade = await enterGrade(
        studentId,
        courseId,
        moduleId,
        score,
        passingScore,
        user.uid,
        user.displayName || 'Unknown',
        notes
      );
      
      setGrade(newGrade);
      setGradeHistory(prev => [newGrade, ...prev]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enter grade';
      setError(message);
      return false;
    }
  }, [user, studentId, courseId, moduleId]);

  const correctCurrentGrade = useCallback(async (
    newScore: number,
    passingScore: number,
    reason: string,
    notes?: string
  ): Promise<boolean> => {
    if (!user?.uid) {
      setError('Must be logged in to correct grades');
      return false;
    }
    
    if (!grade) {
      setError('No grade to correct');
      return false;
    }
    
    try {
      const correctedGrade = await correctGrade(
        grade.id,
        newScore,
        passingScore,
        reason,
        user.uid,
        user.displayName || 'Unknown',
        notes
      );
      
      setGrade(correctedGrade);
      // Refetch full history to get updated superseded status
      await fetchGrade();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to correct grade';
      setError(message);
      return false;
    }
  }, [user, grade, fetchGrade]);

  return {
    grade,
    gradeHistory,
    isLoading,
    error,
    competencyLevel: grade ? calculateCompetency(grade.score) : null,
    isPassed: grade?.passed ?? false,
    enterNewGrade,
    correctCurrentGrade,
    refetch: fetchGrade,
  };
};

// ============================================
// USER GRADES SUMMARY HOOK
// ============================================

interface UseUserGradesReturn {
  grades: GradeRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Computed summary
  summary: {
    totalGraded: number;
    passed: number;
    failed: number;
    averageScore: number;
    competencyBreakdown: Record<CompetencyLevel, number>;
  } | null;
  
  refetch: () => Promise<void>;
}

export const useUserGrades = (userId?: string): UseUserGradesReturn => {
  const { user } = useAuth();
  const targetUserId = userId || user?.uid;
  
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [summary, setSummary] = useState<UseUserGradesReturn['summary']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    if (!targetUserId) {
      setGrades([]);
      setSummary(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [userGrades, userSummary] = await Promise.all([
        getUserGrades(targetUserId),
        getUserCompetencySummary(targetUserId),
      ]);
      
      setGrades(userGrades);
      setSummary(userSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load grades';
      setError(message);
      console.error('useUserGrades fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  return {
    grades,
    isLoading,
    error,
    summary,
    refetch: fetchGrades,
  };
};

// ============================================
// CURRENT USER'S OWN GRADE (STUDENT VIEW)
// ============================================

interface UseMyGradeReturn {
  grade: GradeRecord | null;
  isLoading: boolean;
  error: string | null;
  competencyLevel: CompetencyLevel | null;
  isPassed: boolean;
  refetch: () => Promise<void>;
}

export const useMyGrade = (moduleId: string): UseMyGradeReturn => {
  const { user } = useAuth();
  const [grade, setGrade] = useState<GradeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrade = useCallback(async () => {
    if (!user?.uid || !moduleId) {
      setGrade(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const currentGrade = await getCurrentGrade(user.uid, moduleId);
      setGrade(currentGrade);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load grade';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, moduleId]);

  useEffect(() => {
    fetchGrade();
  }, [fetchGrade]);

  return {
    grade,
    isLoading,
    error,
    competencyLevel: grade ? calculateCompetency(grade.score) : null,
    isPassed: grade?.passed ?? false,
    refetch: fetchGrade,
  };
};