/**
 * Cohort Service
 *
 * Handles Firestore operations for cohort management and bulk enrollment.
 * Cohorts define groups of users by department/jobTitle filters and assign
 * them to courses in bulk. All mutations trigger audit logs.
 *
 * @module services/cohortService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Cohort, CohortFilterCriteria, User } from '../functions/src/types';
import { auditService } from './auditService';
import { generateId } from '../utils';

const COHORTS_COLLECTION = 'cohorts';
const USERS_COLLECTION = 'users';
const ENROLLMENTS_COLLECTION = 'enrollments';

// ============================================
// TYPE CONVERTERS
// ============================================

const docToCohort = (docSnap: any): Cohort => ({
  id: docSnap.id,
  name: docSnap.data().name || '',
  description: docSnap.data().description || '',
  filterCriteria: docSnap.data().filterCriteria || {},
  courseIds: docSnap.data().courseIds || [],
  createdBy: docSnap.data().createdBy || '',
  createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || '',
});

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get all cohorts, ordered by creation date (newest first)
 */
export const getCohorts = async (): Promise<Cohort[]> => {
  const q = query(
    collection(db, COHORTS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToCohort);
};

/**
 * Get a single cohort by ID
 */
export const getCohort = async (id: string): Promise<Cohort | null> => {
  const docRef = doc(db, COHORTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docToCohort(docSnap);
};

/**
 * Get users matching a cohort's filter criteria.
 *
 * Strategy: Fetch users filtered by department (if specified) via Firestore
 * query, then apply jobTitle filter in memory. If no department filter,
 * fetch all users and filter by jobTitle client-side.
 */
export const getMatchingUsers = async (
  filterCriteria: CohortFilterCriteria
): Promise<User[]> => {
  const { departments, jobTitles } = filterCriteria;
  const hasDepartments = departments && departments.length > 0;
  const hasJobTitles = jobTitles && jobTitles.length > 0;

  let usersQuery;

  if (hasDepartments) {
    // Firestore 'in' supports up to 30 values
    usersQuery = query(
      collection(db, USERS_COLLECTION),
      where('department', 'in', departments)
    );
  } else {
    usersQuery = query(collection(db, USERS_COLLECTION));
  }

  const snapshot = await getDocs(usersQuery);
  let users: User[] = snapshot.docs.map(d => {
    const data = d.data() as Record<string, any>;
    return {
      uid: data.uid || d.id,
      displayName: data.displayName || '',
      email: data.email || '',
      role: data.role || 'staff',
      department: data.department,
      jobTitle: data.jobTitle,
    };
  });

  // Client-side jobTitle filter
  if (hasJobTitles) {
    const titleSet = new Set(jobTitles!.map(t => t.toLowerCase()));
    users = users.filter(u =>
      u.jobTitle && titleSet.has(u.jobTitle.toLowerCase())
    );
  }

  return users;
};

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Create a new cohort
 */
export const createCohort = async (
  data: Omit<Cohort, 'id' | 'createdAt'>,
  actorId: string,
  actorName: string
): Promise<string> => {
  const id = generateId();
  const docRef = doc(db, COHORTS_COLLECTION, id);

  await setDoc(docRef, {
    name: data.name,
    description: data.description,
    filterCriteria: data.filterCriteria,
    courseIds: data.courseIds,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await auditService.logToFirestore(
    actorId,
    actorName,
    'COHORT_CREATE',
    id,
    `Created cohort "${data.name}"`,
    { filterCriteria: data.filterCriteria, courseCount: data.courseIds.length }
  );

  return id;
};

/**
 * Update an existing cohort
 */
export const updateCohort = async (
  id: string,
  data: Partial<Omit<Cohort, 'id' | 'createdAt' | 'createdBy'>>,
  actorId: string,
  actorName: string
): Promise<void> => {
  const docRef = doc(db, COHORTS_COLLECTION, id);

  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  await auditService.logToFirestore(
    actorId,
    actorName,
    'COHORT_UPDATE',
    id,
    `Updated cohort "${data.name || id}"`,
    { updatedFields: Object.keys(data) }
  );
};

/**
 * Delete a cohort
 */
export const deleteCohort = async (
  id: string,
  cohortName: string,
  actorId: string,
  actorName: string
): Promise<void> => {
  const docRef = doc(db, COHORTS_COLLECTION, id);
  await deleteDoc(docRef);

  await auditService.logToFirestore(
    actorId,
    actorName,
    'COHORT_DELETE',
    id,
    `Deleted cohort "${cohortName}"`
  );
};

// ============================================
// BULK ENROLLMENT
// ============================================

export interface BulkEnrollResult {
  created: number;
  skipped: number;
  total: number;
}

/**
 * Bulk enroll all users matching a cohort's filters into the cohort's courses.
 *
 * Idempotent: uses deterministic enrollment IDs ({userId}_{courseId}).
 * Existing enrollments are skipped, not duplicated.
 *
 * Firestore batch limit is 500 operations per batch; this function
 * handles splitting across multiple batches if needed.
 */
export const bulkEnrollCohort = async (
  cohortId: string,
  actorId: string,
  actorName: string
): Promise<BulkEnrollResult> => {
  // 1. Fetch the cohort
  const cohort = await getCohort(cohortId);
  if (!cohort) throw new Error(`Cohort ${cohortId} not found`);

  // 2. Get matching users
  const matchedUsers = await getMatchingUsers(cohort.filterCriteria);
  if (matchedUsers.length === 0) {
    return { created: 0, skipped: 0, total: 0 };
  }

  // 3. Build list of enrollment pairs and check which already exist
  const pairs: { userId: string; courseId: string; enrollmentId: string }[] = [];
  for (const user of matchedUsers) {
    for (const courseId of cohort.courseIds) {
      pairs.push({
        userId: user.uid,
        courseId,
        enrollmentId: `${user.uid}_${courseId}`,
      });
    }
  }

  // Check existing enrollments
  const existingIds = new Set<string>();
  for (const pair of pairs) {
    const docRef = doc(db, ENROLLMENTS_COLLECTION, pair.enrollmentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      existingIds.add(pair.enrollmentId);
    }
  }

  // 4. Create missing enrollments in batches of 500
  const toCreate = pairs.filter(p => !existingIds.has(p.enrollmentId));
  const BATCH_LIMIT = 500;

  for (let i = 0; i < toCreate.length; i += BATCH_LIMIT) {
    const batchSlice = toCreate.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const pair of batchSlice) {
      const docRef = doc(db, ENROLLMENTS_COLLECTION, pair.enrollmentId);
      batch.set(docRef, {
        userId: pair.userId,
        courseId: pair.courseId,
        progress: 0,
        status: 'not_started',
        enrolledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  const result: BulkEnrollResult = {
    created: toCreate.length,
    skipped: existingIds.size,
    total: pairs.length,
  };

  // 5. Audit log the bulk operation
  await auditService.logToFirestore(
    actorId,
    actorName,
    'BULK_ENROLLMENT',
    cohortId,
    `Bulk enrolled cohort "${cohort.name}": ${result.created} created, ${result.skipped} skipped`,
    {
      cohortId,
      cohortName: cohort.name,
      created: result.created,
      skipped: result.skipped,
      total: result.total,
      courseIds: cohort.courseIds,
      matchedUserCount: matchedUsers.length,
    }
  );

  return result;
};
