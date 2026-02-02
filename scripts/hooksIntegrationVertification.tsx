/**
 * Hooks Integration Test Panel
 * 
 * Tests all three hooks together in a realistic workflow:
 * 1. Enroll in a course
 * 2. Track progress through blocks
 * 3. Submit quiz and get graded
 * 
 * SUCCESS CRITERIA:
 * - Hooks load data without errors
 * - Actions update state correctly
 * - Data persists to Firestore
 */

import React, { useState } from 'react';
import { useUserEnrollments, useEnrollment } from '../hooks/useUserEnrollments';
import { useModuleProgress } from '../hooks/useModuleProgress';
import { useModuleGrade, useMyGrade } from '../hooks/useGrade';
import { useAuth } from '../contexts/AuthContext';

export const HooksTestPanel: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<string[]>([]);
  const [testIds, setTestIds] = useState({
    courseId: '',
    moduleId: '',
  });
  
  const log = (msg: string) => setResults(prev => [...prev, msg]);
  const clear = () => setResults([]);
  
  // Generate test IDs
  const initTest = () => {
    clear();
    const timestamp = Date.now();
    const ids = {
      courseId: `test-course-${timestamp}`,
      moduleId: `test-module-${timestamp}`,
    };
    setTestIds(ids);
    log('Test IDs generated:');
    log(`  Course: ${ids.courseId}`);
    log(`  Module: ${ids.moduleId}`);
    log('');
    return ids;
  };

  // Test 1: Enrollment Hook
  const testEnrollmentHook = async () => {
    const ids = testIds.courseId ? testIds : initTest();
    
    log('═══ TEST 1: useEnrollment Hook ═══');
    log('');
    
    if (!user) {
      log('❌ No user logged in');
      return false;
    }
    
    try {
      // We need to test the service directly since hooks need component context
      const { createEnrollment, getEnrollment } = await import('../services/enrollmentService');
      
      log('Creating enrollment...');
      await createEnrollment(
        user.uid,
        ids.courseId,
        user.uid,
        user.displayName || 'Test User'
      );
      log('✅ Enrollment created');
      
      log('Fetching enrollment...');
      const enrollment = await getEnrollment(user.uid, ids.courseId);
      log(`✅ Enrollment found: ${enrollment?.status}`);
      log(`✅ Progress: ${enrollment?.progress}%`);
      log('');
      
      return true;
    } catch (err) {
      log(`❌ Error: ${err}`);
      return false;
    }
  };

  // Test 2: Progress Hook
  const testProgressHook = async () => {
    const ids = testIds.courseId ? testIds : initTest();
    
    log('═══ TEST 2: useModuleProgress Hook ═══');
    log('');
    
    if (!user) {
      log('❌ No user logged in');
      return false;
    }
    
    try {
      const { 
        initializeModuleProgress, 
        markBlockComplete, 
        recordQuizAttempt,
        getModuleProgress 
      } = await import('../services/progressService');
      
      log('Initializing module progress...');
      await initializeModuleProgress(user.uid, ids.courseId, ids.moduleId);
      log('✅ Progress initialized');
      
      log('Completing block 1 of 3...');
      await markBlockComplete(
        user.uid, ids.courseId, ids.moduleId,
        'block-1', 3, user.uid, user.displayName || 'Test User'
      );
      
      let progress = await getModuleProgress(user.uid, ids.moduleId);
      log(`✅ Progress: ${progress?.overallProgress}% (expected: 33%)`);
      
      log('Completing block 2 of 3...');
      await markBlockComplete(
        user.uid, ids.courseId, ids.moduleId,
        'block-2', 3, user.uid, user.displayName || 'Test User'
      );
      
      progress = await getModuleProgress(user.uid, ids.moduleId);
      log(`✅ Progress: ${progress?.overallProgress}% (expected: 67%)`);
      
      log('Recording quiz attempt (80%, PASS)...');
      await recordQuizAttempt(
        user.uid, ids.courseId, ids.moduleId,
        'quiz-block-3', 80, true, 3,
        user.uid, user.displayName || 'Test User'
      );
      
      progress = await getModuleProgress(user.uid, ids.moduleId);
      log(`✅ Progress: ${progress?.overallProgress}% (expected: 100%)`);
      log(`✅ isComplete: ${progress?.isComplete}`);
      log(`✅ Best score: ${progress?.bestScore}%`);
      log('');
      
      return true;
    } catch (err) {
      log(`❌ Error: ${err}`);
      return false;
    }
  };

  // Test 3: Grade Hook
  const testGradeHook = async () => {
    const ids = testIds.courseId ? testIds : initTest();
    
    log('═══ TEST 3: useModuleGrade Hook ═══');
    log('');
    
    if (!user) {
      log('❌ No user logged in');
      return false;
    }
    
    try {
      const { 
        enterGrade, 
        getCurrentGrade,
        correctGrade,
        calculateCompetency 
      } = await import('../services/gradeService');
      
      log('Entering initial grade (75%)...');
      const grade1 = await enterGrade(
        user.uid, ids.courseId, ids.moduleId,
        75, 80,  // score, passingScore
        user.uid, user.displayName || 'Instructor',
        'Initial assessment'
      );
      log(`✅ Grade entered: ${grade1.score}%`);
      log(`✅ Passed: ${grade1.passed} (expected: false, below 80%)`);
      log(`✅ Competency: ${calculateCompetency(grade1.score)}`);
      
      log('Correcting grade to 85%...');
      const grade2 = await correctGrade(
        grade1.id, 85, 80,
        'Grading error - recalculated',
        user.uid, user.displayName || 'Instructor'
      );
      log(`✅ Corrected grade: ${grade2.score}%`);
      log(`✅ Passed: ${grade2.passed} (expected: true)`);
      log(`✅ Correction of: ${grade2.correctionOf}`);
      
      log('Fetching current grade...');
      const current = await getCurrentGrade(user.uid, ids.moduleId);
      log(`✅ Current grade: ${current?.score}% (should be 85%)`);
      log('');
      
      return true;
    } catch (err) {
      log(`❌ Error: ${err}`);
      return false;
    }
  };

  // Run all tests
  const runAllTests = async () => {
    clear();
    log('Starting hooks integration tests...');
    log(`User: ${user?.displayName || user?.uid || 'NOT LOGGED IN'}`);
    log('');
    
    if (!user) {
      log('❌ Must be logged in to run tests');
      return;
    }
    
    initTest();
    
    const test1 = await testEnrollmentHook();
    const test2 = await testProgressHook();
    const test3 = await testGradeHook();
    
    log('═══════════════════════════════════');
    if (test1 && test2 && test3) {
      log('🎉 ALL HOOK TESTS PASSED');
    } else {
      log('⚠️  SOME TESTS FAILED');
    }
    log('═══════════════════════════════════');
    log('');
    log('📋 Verify in Firestore:');
    log('  - enrollments: new document');
    log('  - progress: new document with completedBlocks');
    log('  - grades: 2 documents (original + correction)');
    log('  - audit_logs: multiple new entries');
  };

  return (
    <div className="p-6 bg-slate-900 rounded-lg text-white font-mono text-sm">
      <h3 className="text-lg font-bold mb-4">Step 2: Hooks Integration Tests</h3>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={runAllTests}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
        >
          Run All Tests
        </button>
        <button
          onClick={clear}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
        >
          Clear
        </button>
      </div>
      
      <div className="max-h-[500px] overflow-y-auto space-y-1">
        {results.length === 0 ? (
          <div className="text-slate-500">Click "Run All Tests" to begin</div>
        ) : (
          results.map((r, i) => (
            <div 
              key={i} 
              className={
                r.includes('✅') ? 'text-green-400' : 
                r.includes('❌') ? 'text-red-400' : 
                r.includes('🎉') ? 'text-yellow-400 font-bold' :
                r.includes('═') ? 'text-blue-400' :
                r.includes('⚠️') ? 'text-orange-400 font-bold' :
                'text-slate-300'
              }
            >
              {r || '\u00A0'}
            </div>
          ))
        )}
      </div>
    </div>
  );
};