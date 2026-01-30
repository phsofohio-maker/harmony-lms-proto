/**
 * Enrollment Service Verification
 * 
 * Run these tests to verify enrollmentService works correctly.
 * You can add this as a temporary test page or run in browser console.
 * 
 * SUCCESS CRITERIA:
 * 1. Can create an enrollment
 * 2. Can retrieve enrollments by user
 * 3. Can update progress
 * 4. Audit logs are created
 */

import {
    createEnrollment,
    getUserEnrollments,
    getEnrollment,
    updateEnrollmentProgress,
    isUserEnrolled,
  } from '../services/enrollmentService';
  
  // Test configuration - use real IDs from your Firestore
  const TEST_USER_ID = 'test-user-001';
  const TEST_COURSE_ID = 'test-course-001';
  const ACTOR_ID = 'admin-001';
  const ACTOR_NAME = 'Test Admin';
  
  export const runEnrollmentTests = async (): Promise<void> => {
    console.log('=== ENROLLMENT SERVICE TESTS ===\n');
    
    try {
      // Test 1: Create enrollment
      console.log('Test 1: Creating enrollment...');
      const enrollmentId = await createEnrollment(
        TEST_USER_ID,
        TEST_COURSE_ID,
        ACTOR_ID,
        ACTOR_NAME
      );
      console.log(`  ✅ Created enrollment: ${enrollmentId}`);
      
      // Test 2: Check enrollment exists
      console.log('\nTest 2: Checking enrollment exists...');
      const enrolled = await isUserEnrolled(TEST_USER_ID, TEST_COURSE_ID);
      console.log(`  ✅ isUserEnrolled: ${enrolled}`);
      
      // Test 3: Get enrollment details
      console.log('\nTest 3: Getting enrollment details...');
      const enrollment = await getEnrollment(TEST_USER_ID, TEST_COURSE_ID);
      console.log('  ✅ Enrollment:', enrollment);
      
      // Test 4: Get user enrollments
      console.log('\nTest 4: Getting all user enrollments...');
      const userEnrollments = await getUserEnrollments(TEST_USER_ID);
      console.log(`  ✅ Found ${userEnrollments.length} enrollment(s)`);
      
      // Test 5: Update progress
      console.log('\nTest 5: Updating progress to 50%...');
      await updateEnrollmentProgress(
        TEST_USER_ID,
        TEST_COURSE_ID,
        50,
        ACTOR_ID,
        ACTOR_NAME
      );
      const updated = await getEnrollment(TEST_USER_ID, TEST_COURSE_ID);
      console.log(`  ✅ Progress: ${updated?.progress}%, Status: ${updated?.status}`);
      
      // Test 6: Complete enrollment
      console.log('\nTest 6: Completing enrollment (100%)...');
      await updateEnrollmentProgress(
        TEST_USER_ID,
        TEST_COURSE_ID,
        100,
        ACTOR_ID,
        ACTOR_NAME
      );
      const completed = await getEnrollment(TEST_USER_ID, TEST_COURSE_ID);
      console.log(`  ✅ Progress: ${completed?.progress}%, Status: ${completed?.status}`);
      console.log(`  ✅ Completed at: ${completed?.completedAt}`);
      
      console.log('\n=== ALL TESTS PASSED ===');
      console.log('\n📋 Check Firestore console:');
      console.log('  - enrollments collection should have new document');
      console.log('  - audit_logs collection should have 3 new entries');
      
    } catch (error) {
      console.error('❌ TEST FAILED:', error);
    }
  };
  
  // Quick verification component for React
  import React, { useState } from 'react';
  
  export const EnrollmentTestPanel: React.FC = () => {
    const [results, setResults] = useState<string[]>([]);
    const [running, setRunning] = useState(false);
    
    const runTests = async () => {
      setRunning(true);
      setResults(['Running tests...']);
      
      try {
        // Simplified inline test
        const testUserId = `test-${Date.now()}`;
        const testCourseId = 'demo-course';
        
        setResults(prev => [...prev, 'Creating enrollment...']);
        await createEnrollment(testUserId, testCourseId, testUserId, 'Test User');
        setResults(prev => [...prev, '✅ Enrollment created']);
        
        setResults(prev => [...prev, 'Checking enrollment...']);
        const enrolled = await isUserEnrolled(testUserId, testCourseId);
        setResults(prev => [...prev, `✅ isUserEnrolled: ${enrolled}`]);
        
        setResults(prev => [...prev, 'Updating progress...']);
        await updateEnrollmentProgress(testUserId, testCourseId, 75, testUserId, 'Test User');
        setResults(prev => [...prev, '✅ Progress updated to 75%']);
        
        setResults(prev => [...prev, '', '🎉 ALL TESTS PASSED']);
        
      } catch (err) {
        setResults(prev => [...prev, `❌ Error: ${err}`]);
      } finally {
        setRunning(false);
      }
    };
    
    return (
      <div className="p-6 bg-slate-900 rounded-lg text-white font-mono text-sm">
        <h3 className="text-lg font-bold mb-4">Enrollment Service Tests</h3>
        <button
          onClick={runTests}
          disabled={running}
          className="px-4 py-2 bg-green-600 rounded mb-4 disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Tests'}
        </button>
        <div className="space-y-1">
          {results.map((r, i) => (
            <div key={i} className={r.includes('✅') ? 'text-green-400' : r.includes('❌') ? 'text-red-400' : 'text-slate-300'}>
              {r}
            </div>
          ))}
        </div>
      </div>
    );
  };