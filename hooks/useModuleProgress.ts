/**
 * useModuleProgress Hook
 * 
 * Tracks user progress through a module's blocks.
 * Handles block completion, quiz attempts, and progress calculation.
 * 
 * @module hooks/useModuleProgress
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ModuleProgressRecord,
  getModuleProgress,
  getCourseProgress,
  initializeModuleProgress,
  markBlockComplete,
  recordQuizAttempt,
  resetModuleProgress,
  calculateCourseCompletion,
} from '../services/progressService';
import { useAuth } from '../contexts/AuthContext';

interface UseModuleProgressReturn {
  progress: ModuleProgressRecord | null;
  isLoading: boolean;
  error: string | null;
  
  // Computed
  completionPercent: number;
  isComplete: boolean;
  
  // Actions
  completeBlock: (blockId: string, totalRequiredBlocks: number) => Promise<boolean>;
  submitQuiz: (
    blockId: string,
    score: number,
    passed: boolean,
    totalRequiredBlocks: number
  ) => Promise<boolean>;
  reset: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useModuleProgress = (
  courseId: string,
  moduleId: string
): UseModuleProgressReturn => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ModuleProgressRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user?.uid || !moduleId) {
      setProgress(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      let data = await getModuleProgress(user.uid, moduleId);
      
      // Initialize if doesn't exist
      if (!data) {
        data = await initializeModuleProgress(user.uid, courseId, moduleId);
      }
      
      setProgress(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load progress';
      setError(message);
      console.error('useModuleProgress fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, courseId, moduleId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const completeBlock = useCallback(async (
    blockId: string,
    totalRequiredBlocks: number
  ): Promise<boolean> => {
    if (!user?.uid) {
      setError('Must be logged in');
      return false;
    }
    
    try {
      const updated = await markBlockComplete(
        user.uid,
        courseId,
        moduleId,
        blockId,
        totalRequiredBlocks,
        user.uid,
        user.displayName || 'Unknown'
      );
      
      setProgress(updated);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark block complete';
      setError(message);
      return false;
    }
  }, [user, courseId, moduleId]);

  const submitQuiz = useCallback(async (
    blockId: string,
    score: number,
    passed: boolean,
    totalRequiredBlocks: number
  ): Promise<boolean> => {
    if (!user?.uid) {
      setError('Must be logged in');
      return false;
    }
    
    try {
      const updated = await recordQuizAttempt(
        user.uid,
        courseId,
        moduleId,
        blockId,
        score,
        passed,
        totalRequiredBlocks,
        user.uid,
        user.displayName || 'Unknown'
      );
      
      setProgress(updated);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record quiz attempt';
      setError(message);
      return false;
    }
  }, [user, courseId, moduleId]);

  const reset = useCallback(async (): Promise<boolean> => {
    if (!user?.uid) {
      setError('Must be logged in');
      return false;
    }
    
    try {
      await resetModuleProgress(
        user.uid,
        moduleId,
        user.uid,
        user.displayName || 'Unknown'
      );
      
      await fetchProgress();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset progress';
      setError(message);
      return false;
    }
  }, [user, moduleId, fetchProgress]);

  return {
    progress,
    isLoading,
    error,
    completionPercent: progress?.overallProgress ?? 0,
    isComplete: progress?.isComplete ?? false,
    completeBlock,
    submitQuiz,
    reset,
    refetch: fetchProgress,
  };
};

/**
 * Hook for course-level progress (aggregates all modules)
 */
interface UseCourseProgressReturn {
  moduleProgress: ModuleProgressRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Computed
  overallPercent: number;
  completedModules: number;
  totalModules: number;
  
  refetch: () => Promise<void>;
}

export const useCourseProgress = (
  courseId: string,
  totalModulesInCourse: number
): UseCourseProgressReturn => {
  const { user } = useAuth();
  const [moduleProgress, setModuleProgress] = useState<ModuleProgressRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user?.uid || !courseId) {
      setModuleProgress([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getCourseProgress(user.uid, courseId);
      setModuleProgress(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load course progress';
      setError(message);
      console.error('useCourseProgress fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, courseId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const completedModules = moduleProgress.filter(mp => mp.isComplete).length;
  const overallPercent = calculateCourseCompletion(moduleProgress, totalModulesInCourse);

  return {
    moduleProgress,
    isLoading,
    error,
    overallPercent,
    completedModules,
    totalModules: totalModulesInCourse,
    refetch: fetchProgress,
  };
};