/**
 * User Management Service
 *
 * Admin operations for staff lifecycle: deactivation and reactivation.
 * Both mutations route through Cloud Functions because the Firebase Admin
 * SDK call to disable/enable an Auth account is server-only — the client
 * Firebase SDK has no equivalent. The Cloud Functions also enforce the
 * admin role check server-side as a hard security boundary.
 *
 * @module services/userManagementService
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

interface DeactivateResponse {
  success: boolean;
  uid: string;
}

interface ReactivateResponse {
  success: boolean;
  uid: string;
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
