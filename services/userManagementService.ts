/**
 * User Management Service
 *
 * Admin operations for staff lifecycle: profile edits, role changes,
 * deactivation, and reactivation.
 *
 * Routing rules:
 * - Profile fields (displayName, department, jobTitle, licenseNumber,
 *   licenseExpiry) → direct Firestore write. Security rules already
 *   permit admin updates on the users collection.
 * - Role change → existing `setUserRole` Cloud Function. JWT custom
 *   claims require server-side Admin SDK; the function also syncs the
 *   Firestore profile role and writes an audit log.
 * - Deactivate / reactivate → `deactivateUser` / `reactivateUser` Cloud
 *   Functions. Firebase Auth disable/enable is server-only.
 *
 * @module services/userManagementService
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import { UserRoleType } from '../functions/src/types';
import { auditService } from './auditService';

export interface StaffProfileUpdate {
  displayName?: string;
  department?: string;
  jobTitle?: string;
  /** Null clears the field. Undefined leaves it untouched. */
  licenseNumber?: string | null;
  /** ISO date string. Null clears the field. */
  licenseExpiry?: string | null;
}

export interface StaffActor {
  uid: string;
  displayName: string;
}

interface DeactivateResponse {
  success: boolean;
  uid: string;
}

interface ReactivateResponse {
  success: boolean;
  uid: string;
}

/**
 * Updates a staff member's profile fields directly in Firestore.
 * Excludes `role` and `uid` (those routes go through Cloud Functions or
 * are immutable). Caller must be an admin — enforced by security rules.
 *
 * Returns silently when there is nothing to write so callers don't need
 * to dirty-check before invoking.
 */
export async function updateStaffProfile(
  targetUid: string,
  updates: StaffProfileUpdate,
  actor: StaffActor
): Promise<void> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      // null is intentional (clears the field); only `undefined` is skipped.
      sanitized[key] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) return;

  await updateDoc(doc(db, 'users', targetUid), {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });

  const changeDescription = Object.entries(sanitized)
    .map(([key, val]) => `${key}: ${val === null ? '(cleared)' : `"${val}"`}`)
    .join(', ');

  await auditService.logToFirestore(
    actor.uid,
    actor.displayName,
    'USER_PROFILE_UPDATE',
    targetUid,
    `Profile updated: ${changeDescription}`,
    { updates: sanitized }
  );
}

/**
 * Changes a staff member's role via the `setUserRole` Cloud Function.
 * The Cloud Function updates JWT custom claims, syncs the Firestore
 * profile, and writes the audit log. The target must sign out and back
 * in for the new claims to take effect on their next session.
 */
export async function changeStaffRole(
  targetUid: string,
  newRole: UserRoleType
): Promise<{ success: boolean; uid: string; role: UserRoleType }> {
  const functions = getFunctions();
  const callable = httpsCallable<
    { targetUid: string; role: UserRoleType },
    { success: boolean; uid: string; role: UserRoleType }
  >(functions, 'setUserRole');
  const result = await callable({ targetUid, role: newRole });
  return result.data;
}

/**
 * Deactivates a staff account.
 * Disables Firebase Auth (blocks login immediately) and flags the Firestore
 * profile with deactivation metadata. All historical data (enrollments,
 * grades, certificates, audit log entries, policy signatures) is preserved.
 *
 * @throws functions/permission-denied when caller is not an admin.
 * @throws functions/failed-precondition for self-deactivation, last-admin,
 *   or already-deactivated cases.
 */
export async function deactivateStaff(targetUid: string): Promise<DeactivateResponse> {
  const functions = getFunctions();
  const callable = httpsCallable<{ targetUid: string }, DeactivateResponse>(
    functions,
    'deactivateUser'
  );
  const result = await callable({ targetUid });
  return result.data;
}

/**
 * Reactivates a previously deactivated staff account.
 * Re-enables Firebase Auth login and restores active status.
 *
 * @throws functions/failed-precondition if the user is not currently deactivated.
 */
export async function reactivateStaff(targetUid: string): Promise<ReactivateResponse> {
  const functions = getFunctions();
  const callable = httpsCallable<{ targetUid: string }, ReactivateResponse>(
    functions,
    'reactivateUser'
  );
  const result = await callable({ targetUid });
  return result.data;
}
