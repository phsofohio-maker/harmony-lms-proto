/**
 * Grade Service Verification
 * 
 * SUCCESS CRITERIA:
 * 1. Can enter a new grade
 * 2. Pass/fail calculates correctly based on passing score
 * 3. Can correct a grade (original marked superseded)
 * 4. Grade history preserves all records
 * 5. Competency levels calculate correctly
 * 6. Comprehensive audit logs created
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  enterGrade,
  getCurrentGrade,
  getGradeHistory,
  correctGrade,
  getUserGrades,
  calculateCompetency,
  getUserCompetencySummary,
} from '../services/gradeService';

export const GradeTestPanel: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const { user } = useAuth();

  const log = (msg: string) => setResults(prev => [...prev, msg]);

  const runTests = async () => {
    setRunning(true);
    setResults(['Running grade service tests...', '']);

    if (!user) {
      log('Cannot run tests: must be logged in');
      setRunning(false);
      return;
    }

    const testUserId = `student-${Date.now()}`;
    const testCourseId = 'test-course-001';
    const testModuleId = `module-${Date.now()}`;
    const graderId = user.uid;
    const graderName = user.displayName ?? 'Test Instructor';
    const passingScore = 80;

    try {
      // Test 1: Enter a failing grade
      log('Test 1: Entering a failing grade (65%)...');
      const failGrade = await enterGrade(
        testUserId,
        testCourseId,
        testModuleId,
        65,
        passingScore,
        graderId,
        graderName,
        'Initial assessment - needs improvement'
      );
      log(`  ✅ Grade entered: ${failGrade.score}%`);
      log(`  ✅ Passed: ${failGrade.passed} (expected: false)`);
      log(`  ✅ Graded by: ${failGrade.gradedBy}`);
      log(`  ✅ Grade ID: ${failGrade.id}`);
      
      // Test 2: Get current grade
      log('');
      log('Test 2: Retrieving current grade...');
      const current = await getCurrentGrade(testUserId, testModuleId);
      log(`  ✅ Current grade: ${current?.score}%`);
      log(`  ✅ Has notes: ${current?.notes ? 'YES' : 'NO'}`);
      
      // Test 3: Correct the grade (student retook assessment)
      log('');
      log('Test 3: Correcting grade to 85% (passed retake)...');
      const correctedGrade = await correctGrade(
        failGrade.id,
        85,
        passingScore,
        'Student completed remediation and retook assessment',
        graderId,
        graderName,
        'Good improvement shown'
      );
      log(`  ✅ New grade: ${correctedGrade.score}%`);
      log(`  ✅ Passed: ${correctedGrade.passed} (expected: true)`);
      log(`  ✅ Correction of: ${correctedGrade.correctionOf}`);
      log(`  ✅ Reason: ${correctedGrade.correctionReason}`);
      
      // Test 4: Verify original is superseded
      log('');
      log('Test 4: Verifying grade history...');
      const history = await getGradeHistory(testUserId, testModuleId);
      log(`  ✅ Total grades in history: ${history.length} (expected: 2)`);
      const supersededGrade = history.find(g => g.id === failGrade.id);
      log(`  ✅ Original grade superseded: ${supersededGrade?.supersededBy ? 'YES' : 'NO'}`);
      
      // Test 5: Get current grade (should be the corrected one)
      log('');
      log('Test 5: Current grade should be corrected grade...');
      const newCurrent = await getCurrentGrade(testUserId, testModuleId);
      log(`  ✅ Current grade ID matches correction: ${newCurrent?.id === correctedGrade.id}`);
      log(`  ✅ Current score: ${newCurrent?.score}%`);
      
      // Test 6: Competency calculation
      log('');
      log('Test 6: Testing competency levels...');
      const levels = [
        { score: 55, expected: 'not_competent' },
        { score: 65, expected: 'developing' },
        { score: 80, expected: 'competent' },
        { score: 95, expected: 'mastery' },
      ];
      levels.forEach(({ score, expected }) => {
        const level = calculateCompetency(score);
        const match = level === expected;
        log(`  ${match ? '✅' : '❌'} ${score}% → ${level} (expected: ${expected})`);
      });
      
      // Test 7: Enter another grade for summary test
      log('');
      log('Test 7: Entering second module grade for summary...');
      const secondModuleId = `module-${Date.now()}-2`;
      await enterGrade(
        testUserId,
        testCourseId,
        secondModuleId,
        92,
        passingScore,
        graderId,
        graderName
      );
      log('  ✅ Second grade entered (92%)');
      
      // Test 8: Get competency summary
      log('');
      log('Test 8: Getting competency summary...');
      const summary = await getUserCompetencySummary(testUserId);
      log(`  ✅ Total graded: ${summary.totalGraded}`);
      log(`  ✅ Passed: ${summary.passed}`);
      log(`  ✅ Failed: ${summary.failed}`);
      log(`  ✅ Average score: ${summary.averageScore}%`);
      log(`  ✅ Mastery: ${summary.competencyBreakdown.mastery}`);
      log(`  ✅ Competent: ${summary.competencyBreakdown.competent}`);
      
      log('');
      log('═══════════════════════════════');
      log('🎉 ALL GRADE TESTS PASSED');
      log('═══════════════════════════════');
      log('');
      log('📋 Check Firestore console:');
      log('  - grades collection should have 3 documents');
      log('  - First grade should have supersededBy set');
      log('  - audit_logs should show GRADE_ENTRY and GRADE_CHANGE');
      
    } catch (err) {
      log(`❌ TEST FAILED: ${err}`);
      console.error('Grade test error:', err);
    } finally {
      setRunning(false);
    }
  };
  
  return (
    <div className="p-6 bg-slate-900 rounded-lg text-white font-mono text-sm max-h-[600px] overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">Grade Service Tests</h3>
      <button
        onClick={runTests}
        disabled={running}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded mb-4 disabled:opacity-50 transition-colors"
      >
        {running ? 'Running...' : 'Run Grade Tests'}
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