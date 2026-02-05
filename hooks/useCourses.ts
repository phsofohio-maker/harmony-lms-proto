/**
 * useCourses Hook
 * 
 * Provides course listing with loading and error states.
 * Respects Firestore security rules based on user role.
 * 
 * @module hooks/useCourses
 */

import { useState, useEffect, useCallback } from 'react';
import { Course } from '../functions/src/types';
import { getCourses, createCourse } from '../services/courseService';
import { useAuth } from '../contexts/AuthContext';

interface UseCoursesReturn {
  courses: Course[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addCourse: (course: Omit<Course, 'id' | 'modules'>) => Promise<string | null>;
}

export const useCourses = (): UseCoursesReturn => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getCourses();
      setCourses(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load courses';
      setError(message);
      console.error('useCourses fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const addCourse = useCallback(async (
    course: Omit<Course, 'id' | 'modules'>
  ): Promise<string | null> => {
    if (!user) {
      setError('Must be logged in to create courses');
      return null;
    }
    
    try {
      const id = await createCourse(course, user.uid, user.displayName);
      await fetchCourses(); // Refresh list
      return id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create course';
      setError(message);
      return null;
    }
  }, [user, fetchCourses]);

  return {
    courses,
    isLoading,
    error,
    refetch: fetchCourses,
    addCourse,
  };
};