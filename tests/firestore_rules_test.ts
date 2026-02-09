/**
 * Firestore Security Rules Test Suite
 * 
 * Tests all security rules using Firebase Emulator.
 * Run with: npm run test:rules
 * 
 * Prerequisites:
 * 1. Firebase emulator must be running: firebase emulators:start
 * 2. Install dependencies: npm install --save-dev @firebase/rules-unit-testing
 * 
 * @module tests/firestore.rules.test
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// TEST SETUP
// ============================================

let testEnv: RulesTestEnvironment;

// Mock user contexts
const ADMIN_UID = 'admin-user-123';
const INSTRUCTOR_UID = 'instructor-user-456';
const STAFF_UID = 'staff-user-789';
const OTHER_STAFF_UID = 'other-staff-999';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'harmony-lms-test',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ============================================
// HELPER FUNCTIONS
// ============================================

const getAuthContext = (uid: string, role: string) => {
  return testEnv.authenticatedContext(uid, { role });
};

const getUnauthContext = () => {
  return testEnv.unauthenticatedContext();
};

// ============================================
// USER COLLECTION TESTS
// ============================================

describe('Users Collection', () => {
  test('Authenticated user can read their own profile', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const userRef = doc(db, 'users', STAFF_UID);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', STAFF_UID), {
        uid: STAFF_UID,
        displayName: 'Test Staff',
        email: 'staff@test.com',
        role: 'staff',
      });
    });
    
    await assertSucceeds(getDoc(userRef));
  });

  test('User cannot read other user profiles', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const otherUserRef = doc(db, 'users', OTHER_STAFF_UID);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', OTHER_STAFF_UID), {
        uid: OTHER_STAFF_UID,
        displayName: 'Other Staff',
        email: 'other@test.com',
        role: 'staff',
      });
    });
    
    await assertFails(getDoc(otherUserRef));
  });

  test('Admin can read any user profile', async () => {
    const db = getAuthContext(ADMIN_UID, 'admin').firestore();
    const staffUserRef = doc(db, 'users', STAFF_UID);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', STAFF_UID), {
        uid: STAFF_UID,
        displayName: 'Test Staff',
        role: 'staff',
      });
    });
    
    await assertSucceeds(getDoc(staffUserRef));
  });

  test('User cannot change their own role', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const userRef = doc(db, 'users', STAFF_UID);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', STAFF_UID), {
        uid: STAFF_UID,
        role: 'staff',
        displayName: 'Test Staff',
      });
    });
    
    await assertFails(updateDoc(userRef, { role: 'admin' }));
  });
});

// ============================================
// ENROLLMENT TESTS
// ============================================

describe('Enrollments Collection', () => {
  test('User can create their own enrollment', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const enrollmentRef = doc(db, 'enrollments', `${STAFF_UID}_course-123`);
    
    await assertSucceeds(setDoc(enrollmentRef, {
      userId: STAFF_UID,
      courseId: 'course-123',
      progress: 0,
      status: 'not_started',
      enrolledAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  test('User cannot create enrollment for another user', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const enrollmentRef = doc(db, 'enrollments', `${OTHER_STAFF_UID}_course-123`);
    
    await assertFails(setDoc(enrollmentRef, {
      userId: OTHER_STAFF_UID,
      courseId: 'course-123',
      progress: 0,
      status: 'not_started',
      enrolledAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  test('User can update their own enrollment progress', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const enrollmentRef = doc(db, 'enrollments', `${STAFF_UID}_course-123`);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'enrollments', `${STAFF_UID}_course-123`), {
        userId: STAFF_UID,
        courseId: 'course-123',
        progress: 0,
        status: 'not_started',
      });
    });
    
    await assertSucceeds(updateDoc(enrollmentRef, { progress: 50 }));
  });

  test('Progress must be between 0 and 100', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const enrollmentRef = doc(db, 'enrollments', `${STAFF_UID}_course-123`);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'enrollments', `${STAFF_UID}_course-123`), {
        userId: STAFF_UID,
        courseId: 'course-123',
        progress: 0,
        status: 'not_started',
      });
    });
    
    await assertFails(updateDoc(enrollmentRef, { progress: 150 }));
  });
});

// ============================================
// GRADE TESTS
// ============================================

describe('Grades Collection', () => {
  test('Instructor can create grades', async () => {
    const db = getAuthContext(INSTRUCTOR_UID, 'instructor').firestore();
    const gradeRef = doc(db, 'grades', `${STAFF_UID}_module-123`);
    
    await assertSucceeds(setDoc(gradeRef, {
      userId: STAFF_UID,
      moduleId: 'module-123',
      score: 85,
      passingScore: 70,
      passed: true,
      gradedBy: INSTRUCTOR_UID,
      gradedAt: new Date(),
    }));
  });

  test('Staff cannot create grades', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const gradeRef = doc(db, 'grades', `${STAFF_UID}_module-123`);
    
    await assertFails(setDoc(gradeRef, {
      userId: STAFF_UID,
      moduleId: 'module-123',
      score: 85,
      passingScore: 70,
      passed: true,
      gradedBy: STAFF_UID,
      gradedAt: new Date(),
    }));
  });

  test('Grade score must be between 0 and 100', async () => {
    const db = getAuthContext(INSTRUCTOR_UID, 'instructor').firestore();
    const gradeRef = doc(db, 'grades', `${STAFF_UID}_module-123`);
    
    await assertFails(setDoc(gradeRef, {
      userId: STAFF_UID,
      moduleId: 'module-123',
      score: 150,
      passingScore: 70,
      passed: true,
      gradedBy: INSTRUCTOR_UID,
      gradedAt: new Date(),
    }));
  });

  test('Grades cannot be deleted', async () => {
    const db = getAuthContext(ADMIN_UID, 'admin').firestore();
    const gradeRef = doc(db, 'grades', `${STAFF_UID}_module-123`);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'grades', `${STAFF_UID}_module-123`), {
        userId: STAFF_UID,
        moduleId: 'module-123',
        score: 85,
        passingScore: 70,
      });
    });
    
    await assertFails(deleteDoc(gradeRef));
  });

  test('Staff can read their own grades', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const gradeRef = doc(db, 'grades', `${STAFF_UID}_module-123`);
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'grades', `${STAFF_UID}_module-123`), {
        userId: STAFF_UID,
        moduleId: 'module-123',
        score: 85,
      });
    });
    
    await assertSucceeds(getDoc(gradeRef));
  });
});

// ============================================
// AUDIT LOG TESTS
// ============================================

describe('Audit Logs Collection', () => {
  test('Authenticated user can create audit log', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const logRef = doc(db, 'audit_logs', 'log-123');
    
    await assertSucceeds(setDoc(logRef, {
      actorId: STAFF_UID,
      actorName: 'Test Staff',
      actionType: 'ENROLLMENT_CREATE',
      targetId: 'enrollment-123',
      details: 'Created enrollment',
      timestamp: new Date(),
    }));
  });

  test('Audit logs cannot be updated', async () => {
    const db = getAuthContext(ADMIN_UID, 'admin').firestore();
    const logRef = doc(db, 'audit_logs', 'log-123');
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs', 'log-123'), {
        actorId: STAFF_UID,
        actionType: 'TEST',
        targetId: 'test-123',
        details: 'Test log',
      });
    });
    
    await assertFails(updateDoc(logRef, { details: 'Modified' }));
  });

  test('Audit logs cannot be deleted', async () => {
    const db = getAuthContext(ADMIN_UID, 'admin').firestore();
    const logRef = doc(db, 'audit_logs', 'log-123');
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs', 'log-123'), {
        actorId: STAFF_UID,
        actionType: 'TEST',
        targetId: 'test-123',
        details: 'Test log',
      });
    });
    
    await assertFails(deleteDoc(logRef));
  });

  test('Only admin can read audit logs', async () => {
    const adminDb = getAuthContext(ADMIN_UID, 'admin').firestore();
    const staffDb = getAuthContext(STAFF_UID, 'staff').firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs', 'log-123'), {
        actorId: STAFF_UID,
        actionType: 'TEST',
        targetId: 'test-123',
        details: 'Test log',
      });
    });
    
    await assertSucceeds(getDoc(doc(adminDb, 'audit_logs', 'log-123')));
    await assertFails(getDoc(doc(staffDb, 'audit_logs', 'log-123')));
  });
});

// ============================================
// PROGRESS TRACKING TESTS
// ============================================

describe('Progress Collection', () => {
  test('User can create their own progress record', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const progressRef = doc(db, 'progress', `${STAFF_UID}_module-123`);
    
    await assertSucceeds(setDoc(progressRef, {
      userId: STAFF_UID,
      courseId: 'course-123',
      moduleId: 'module-123',
      overallProgress: 50,
      isComplete: false,
      completedBlocks: {},
      totalAttempts: 0,
    }));
  });

  test('User cannot create progress for another user', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const progressRef = doc(db, 'progress', `${OTHER_STAFF_UID}_module-123`);
    
    await assertFails(setDoc(progressRef, {
      userId: OTHER_STAFF_UID,
      courseId: 'course-123',
      moduleId: 'module-123',
      overallProgress: 50,
      isComplete: false,
    }));
  });

  test('Progress must be between 0 and 100', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const progressRef = doc(db, 'progress', `${STAFF_UID}_module-123`);
    
    await assertFails(setDoc(progressRef, {
      userId: STAFF_UID,
      courseId: 'course-123',
      moduleId: 'module-123',
      overallProgress: 150,
      isComplete: false,
    }));
  });
});

// ============================================
// COURSE CONTENT TESTS
// ============================================

describe('Courses Collection', () => {
  test('Authenticated users can read published courses', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const courseRef = doc(db, 'courses', 'course-123');
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'courses', 'course-123'), {
        title: 'Test Course',
        status: 'published',
      });
    });
    
    await assertSucceeds(getDoc(courseRef));
  });

  test('Staff cannot read draft courses', async () => {
    const db = getAuthContext(STAFF_UID, 'staff').firestore();
    const courseRef = doc(db, 'courses', 'course-123');
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'courses', 'course-123'), {
        title: 'Draft Course',
        status: 'draft',
      });
    });
    
    await assertFails(getDoc(courseRef));
  });

  test('Instructor can read draft courses', async () => {
    const db = getAuthContext(INSTRUCTOR_UID, 'instructor').firestore();
    const courseRef = doc(db, 'courses', 'course-123');
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'courses', 'course-123'), {
        title: 'Draft Course',
        status: 'draft',
      });
    });
    
    await assertSucceeds(getDoc(courseRef));
  });

  test('Only instructors can create courses', async () => {
    const instructorDb = getAuthContext(INSTRUCTOR_UID, 'instructor').firestore();
    const staffDb = getAuthContext(STAFF_UID, 'staff').firestore();
    
    const courseData = {
      title: 'New Course',
      description: 'Test description',
      status: 'draft',
      createdAt: new Date(),
    };
    
    await assertSucceeds(setDoc(doc(instructorDb, 'courses', 'new-course'), courseData));
    await assertFails(setDoc(doc(staffDb, 'courses', 'new-course-2'), courseData));
  });
});

console.log('✅ All security rules tests defined. Run with: npm run test:rules');
