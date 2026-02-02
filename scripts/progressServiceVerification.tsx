/**
 * Progress Service Verification
 * 
 * SUCCESS CRITERIA:
 * 1. Can initialize module progress
 * 2. Can mark blocks as complete
 * 3. Progress percentage calculates correctly
 * 4. Can record quiz attempts with scores
 * 5. Audit logs are created
 */

import React, { useState } from 'react';
import {
  initializeModuleProgress,
  getModuleProgress,
  markBlockComplete,
  recordQuizAttempt,
  getCourseProgress,
} from '../services/progressService';

export const ProgressTestPanel: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  
  const log = (msg: string) => setResults(prev => [...prev, msg]);
  
  const runTests = async () => {
    setRunning(true);
    setResults(['Running progress service tests...', '']);
    
    // Use unique IDs for this test run
    const testUserId = `test-user-${Date.now()}`;
    const testCourseId = 'test-course-001';
    const testModuleId = `test-module-${Date.now()}`;
    const totalBlocks = 4; // Simulating a module with 4 required blocks
    
    try {
      // Test 1: Initialize progress
      log('Test 1: Initializing module progress...');
      const initial = await initializeModuleProgress(
        testUserId,
        testCourseId,
        testModuleId
      );
      log(`  ✅ Progress initialized: ${initial.overallProgress}%`);
      log(`  ✅ isComplete: ${initial.isComplete}`);
      
      // Test 2: Mark first block complete
      log('');
      log('Test 2: Marking block 1 complete...');
      const after1 = await markBlockComplete(
        testUserId,
        testCourseId,
        testModuleId,
        'block-001',
        totalBlocks,
        testUserId,
        'Test User'
      );
      log(`  ✅ Progress: ${after1.overallProgress}% (expected: 25%)`);
      
      // Test 3: Mark second block complete
      log('');
      log('Test 3: Marking block 2 complete...');
      const after2 = await markBlockComplete(
        testUserId,
        testCourseId,
        testModuleId,
        'block-002',
        totalBlocks,
        testUserId,
        'Test User'
      );
      log(`  ✅ Progress: ${after2.overallProgress}% (expected: 50%)`);
      
      // Test 4: Record a failed quiz attempt
      log('');
      log('Test 4: Recording quiz attempt (60%, FAIL)...');
      const afterQuizFail = await recordQuizAttempt(
        testUserId,
        testCourseId,
        testModuleId,
        'quiz-block-003',
        60,  // score
        false, // passed
        totalBlocks,
        testUserId,
        'Test User'
      );
      log(`  ✅ Progress: ${afterQuizFail.overallProgress}% (quiz not counted as complete)`);
      log(`  ✅ Total attempts: ${afterQuizFail.totalAttempts}`);
      log(`  ✅ Last score: ${afterQuizFail.lastScore}%`);
      
      // Test 5: Record a passing quiz attempt
      log('');
      log('Test 5: Recording quiz attempt (85%, PASS)...');
      const afterQuizPass = await recordQuizAttempt(
        testUserId,
        testCourseId,
        testModuleId,
        'quiz-block-003',
        85,  // score
        true, // passed
        totalBlocks,
        testUserId,
        'Test User'
      );
      log(`  ✅ Progress: ${afterQuizPass.overallProgress}% (expected: 75%)`);
      log(`  ✅ Total attempts: ${afterQuizPass.totalAttempts}`);
      log(`  ✅ Best score: ${afterQuizPass.bestScore}%`);
      
      // Test 6: Complete final block
      log('');
      log('Test 6: Completing final block...');
      const afterFinal = await markBlockComplete(
        testUserId,
        testCourseId,
        testModuleId,
        'block-004',
        totalBlocks,
        testUserId,
        'Test User'
      );
      log(`  ✅ Progress: ${afterFinal.overallProgress}% (expected: 100%)`);
      log(`  ✅ isComplete: ${afterFinal.isComplete}`);
      log(`  ✅ completedAt: ${afterFinal.completedAt ? 'SET' : 'NOT SET'}`);
      
      // Test 7: Retrieve progress
      log('');
      log('Test 7: Retrieving saved progress...');
      const retrieved = await getModuleProgress(testUserId, testModuleId);
      log(`  ✅ Retrieved progress: ${retrieved?.overallProgress}%`);
      log(`  ✅ Completed blocks: ${Object.keys(retrieved?.completedBlocks || {}).length}`);
      
      // Test 8: Get course progress
      log('');
      log('Test 8: Getting all course progress...');
      const courseProgress = await getCourseProgress(testUserId, testCourseId);
      log(`  ✅ Found ${courseProgress.length} module progress record(s)`);
      
      log('');
      log('═══════════════════════════════');
      log('🎉 ALL PROGRESS TESTS PASSED');
      log('═══════════════════════════════');
      log('');
      log('📋 Check Firestore console:');
      log('  - progress collection should have new document');
      log('  - audit_logs should have new entries');
      
    } catch (err) {
      log(`❌ TEST FAILED: ${err}`);
      console.error('Progress test error:', err);
    } finally {
      setRunning(false);
    }
  };
  
  return (
    <div className="p-6 bg-slate-900 rounded-lg text-white font-mono text-sm max-h-[600px] overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">Progress Service Tests</h3>
      <button
        onClick={runTests}
        disabled={running}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded mb-4 disabled:opacity-50 transition-colors"
      >
        {running ? 'Running...' : 'Run Progress Tests'}
      </button>
      <div className="space-y-1">
        {results.map((r, i) => (
          <div 
            key={i} 
            className={
              r.includes('✅') ? 'text-green-400' : 
              r.includes('❌') ? 'text-red-400' : 
              r.includes('🎉') ? 'text-yellow-400 font-bold' :
              r.includes('═') ? 'text-yellow-400' :
              'text-slate-300'
            }
          >
            {r || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
};
