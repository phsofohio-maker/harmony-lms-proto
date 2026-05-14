# GUIDE 15

# Staff Deactivation & Reactivation

| Estimate | Priority | Phase |
| :------- | :------- | :---- |
| 2–3 Days | HIGH | Phase 3 (Operations) |

---

## Root Cause

Parrish HALO has no mechanism to remove staff who leave the organization. Terminated or resigned employees retain active accounts with full access to clinical training content, compliance records, and (for elevated roles) administrative functions. In a CMS-auditable system, orphaned active accounts are a compliance finding.

Hard-deleting accounts is architecturally prohibited: the immutable audit trail, enrollment history, grade records, certificates, and policy signatures all reference user UIDs. Deleting a user document would create orphaned foreign keys across six collections, breaking audit queries and certificate verification. The system was built to never lose data.

The correct pattern is **soft-delete via deactivation**: disable the Firebase Auth account (blocks login immediately), flag the Firestore profile (filters the user from active views), and preserve all historical data intact.

---

## The Contract

### New Fields on User Document

```typescript
// ADD to existing User interface in functions/src/types.ts
export interface User {
  // ... existing fields unchanged ...
  status?: 'active' | 'deactivated';  // undefined treated as 'active' for backward compat
  deactivatedAt?: string;              // ISO timestamp
  deactivatedBy?: string;              // UID of admin who deactivated
  reactivatedAt?: string;              // ISO timestamp (most recent reactivation)
  reactivatedBy?: string;              // UID of admin who reactivated
}
```

**Backward compatibility:** All existing user documents lack a `status` field. Every read path must treat `undefined` as `'active'`. This is a zero-migration change — no backfill required.

### New Audit Action Types

```typescript
// ADD to AuditActionType union in both:
//   - functions/src/types.ts
//   - src/services/auditService.ts
| 'USER_DEACTIVATE'
| 'USER_REACTIVATE'
```

### New Cloud Function

```typescript
// ADD to functions/src/index.ts
export const deactivateUser = onCall(async (request) => { ... });
export const reactivateUser = onCall(async (request) => { ... });
```

### New Service

```typescript
// CREATE src/services/userManagementService.ts
export async function deactivateStaff(targetUid: string): Promise<void>
export async function reactivateStaff(targetUid: string): Promise<void>
```

---

## Architectural Decision: Why Cloud Functions, Not Client-Side

Deactivation requires `admin.auth().updateUser(uid, { disabled: true })` — the Firebase Admin SDK method to disable an Auth account. This API is only available server-side. The client Firebase SDK has no `disableUser()` method. Therefore deactivation and reactivation **must** be Cloud Functions.

This also provides a security boundary: the admin check happens server-side in the Cloud Function, not in client code that could be bypassed.

---

## Deliverables

### A. Type Changes [MODIFY `functions/src/types.ts`]

**Estimate:** 10 minutes | **Risk:** None

Add `status`, `deactivatedAt`, `deactivatedBy`, `reactivatedAt`, `reactivatedBy` as optional fields to the `User` interface (see Contract above).

Add `USER_DEACTIVATE` and `USER_REACTIVATE` to the `AuditActionType` union.

**Verification:** TypeScript compiles clean. No existing code breaks (all new fields are optional).

---

### B. Audit Action Types [MODIFY `src/services/auditService.ts`]

**Estimate:** 5 minutes | **Risk:** None

Add `'USER_DEACTIVATE'` and `'USER_REACTIVATE'` to the client-side `AuditActionType` union in `auditService.ts`.

**Verification:** TypeScript compiles clean.

---

### C. Cloud Functions: `deactivateUser` and `reactivateUser` [MODIFY `functions/src/index.ts`]

**Estimate:** 2–3 hours | **Risk:** MEDIUM (touches Auth + Firestore in a single operation)

#### C.1 `deactivateUser` Cloud Function

```typescript
export const deactivateUser = onCall(async (request) => {
  // 1. Auth gate: must be authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // 2. Role gate: admin only
  if (request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can deactivate accounts.");
  }

  const { targetUid } = request.data;

  // 3. Input validation
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  // 4. Self-protection: admin cannot deactivate themselves
  if (targetUid === request.auth.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot deactivate your own account."
    );
  }

  // 5. Last-admin protection: prevent deactivating the last active admin
  const adminsSnapshot = await db.collection("users")
    .where("role", "==", "admin")
    .get();

  const activeAdmins = adminsSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.status !== 'deactivated' && doc.id !== targetUid;
  });

  if (activeAdmins.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot deactivate the last active admin. Promote another user to admin first."
    );
  }

  // 6. Verify target exists and is not already deactivated
  const targetProfile = await db.collection("users").doc(targetUid).get();
  if (!targetProfile.exists) {
    throw new HttpsError("not-found", "User not found.");
  }
  if (targetProfile.data()?.status === 'deactivated') {
    throw new HttpsError("failed-precondition", "User is already deactivated.");
  }

  try {
    // 7. Disable Firebase Auth account (blocks login immediately)
    await admin.auth().updateUser(targetUid, { disabled: true });

    // 8. Update Firestore profile with deactivation metadata
    await db.collection("users").doc(targetUid).update(
      stripUndefined({
        status: 'deactivated',
        deactivatedAt: admin.firestore.Timestamp.now(),
        deactivatedBy: request.auth.uid,
        updatedAt: admin.firestore.Timestamp.now(),
      })
    );

    // 9. Audit log
    const targetData = targetProfile.data();
    await createAuditLog(
      request.auth.uid,
      request.auth.token.name || "Unknown",
      "USER_DEACTIVATE",
      targetUid,
      `Deactivated account for ${targetData?.displayName || targetUid} (${targetData?.email || 'unknown email'})`,
      {
        targetEmail: targetData?.email,
        targetRole: targetData?.role,
        targetName: targetData?.displayName,
      } as Record<string, unknown>
    );

    logger.info(`User ${targetUid} deactivated by ${request.auth.uid}`);
    return { success: true, uid: targetUid };
  } catch (error) {
    logger.error("Failed to deactivate user:", error);
    throw new HttpsError("internal", "Failed to deactivate user account.");
  }
});
```

#### C.2 `reactivateUser` Cloud Function

```typescript
export const reactivateUser = onCall(async (request) => {
  // 1. Auth gate
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // 2. Role gate: admin only
  if (request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can reactivate accounts.");
  }

  const { targetUid } = request.data;

  // 3. Input validation
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  // 4. Verify target exists and IS deactivated
  const targetProfile = await db.collection("users").doc(targetUid).get();
  if (!targetProfile.exists) {
    throw new HttpsError("not-found", "User not found.");
  }
  if (targetProfile.data()?.status !== 'deactivated') {
    throw new HttpsError("failed-precondition", "User is not deactivated.");
  }

  try {
    // 5. Re-enable Firebase Auth account
    await admin.auth().updateUser(targetUid, { disabled: false });

    // 6. Update Firestore profile
    await db.collection("users").doc(targetUid).update(
      stripUndefined({
        status: 'active',
        reactivatedAt: admin.firestore.Timestamp.now(),
        reactivatedBy: request.auth.uid,
        updatedAt: admin.firestore.Timestamp.now(),
      })
    );

    // 7. Audit log
    const targetData = targetProfile.data();
    await createAuditLog(
      request.auth.uid,
      request.auth.token.name || "Unknown",
      "USER_REACTIVATE",
      targetUid,
      `Reactivated account for ${targetData?.displayName || targetUid} (${targetData?.email || 'unknown email'})`,
      {
        targetEmail: targetData?.email,
        targetRole: targetData?.role,
        targetName: targetData?.displayName,
        previousDeactivatedAt: targetData?.deactivatedAt?.toDate?.()?.toISOString(),
      } as Record<string, unknown>
    );

    logger.info(`User ${targetUid} reactivated by ${request.auth.uid}`);
    return { success: true, uid: targetUid };
  } catch (error) {
    logger.error("Failed to reactivate user:", error);
    throw new HttpsError("internal", "Failed to reactivate user account.");
  }
});
```

**Key design decisions in both functions:**
- `stripUndefined` is applied before every Firestore write (project invariant)
- `createAuditLog` is called with the existing server-side helper (not the client auditService)
- Firebase Auth disable/enable is the first operation — if it fails, Firestore is never updated (fail-fast)
- Metadata captures the target's identity at deactivation time for audit readability

**Verification:**
1. `cd functions && npm run build` — compiles clean
2. `firebase deploy --only functions` — deploys without errors
3. Calling `deactivateUser` with a non-admin token returns `permission-denied`
4. Calling `deactivateUser` with `targetUid === request.auth.uid` returns `failed-precondition`

---

### D. Client Service: `userManagementService.ts` [CREATE `src/services/userManagementService.ts`]

**Estimate:** 30 minutes | **Risk:** Low

```typescript
/**
 * User Management Service
 *
 * Admin operations for staff lifecycle: deactivation and reactivation.
 * All mutations route through Cloud Functions (Firebase Admin SDK required).
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
 * Disables Firebase Auth (blocks login) and flags Firestore profile.
 * All historical data (enrollments, grades, certificates) is preserved.
 *
 * @throws Error if user is last admin, self-deactivation, or already deactivated
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
 * @throws Error if user is not currently deactivated
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
```

**Verification:** Import in a test file, confirm TypeScript compiles clean.

---

### E. UserManagement Page Updates [MODIFY `src/pages/UserManagement.tsx`]

**Estimate:** 3–4 hours | **Risk:** MEDIUM (significant UI changes)

This is the largest deliverable. The page currently renders a single table of all users. It needs to be restructured into two sections with deactivation/reactivation modals.

#### E.1 State Changes

Add to component state:
```typescript
// Tab state for active vs inactive view
const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

// Deactivation modal
const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
const [isDeactivating, setIsDeactivating] = useState(false);
const [deactivateConfirmText, setDeactivateConfirmText] = useState('');

// Reactivation modal
const [reactivatingUser, setReactivatingUser] = useState<User | null>(null);
const [isReactivating, setIsReactivating] = useState(false);
```

#### E.2 Filtered User Lists

```typescript
const activeUsers = useMemo(
  () => filteredUsers.filter(u => u.status !== 'deactivated'),
  [filteredUsers]
);

const inactiveUsers = useMemo(
  () => filteredUsers.filter(u => u.status === 'deactivated'),
  [filteredUsers]
);

const displayedUsers = activeTab === 'active' ? activeUsers : inactiveUsers;
```

#### E.3 Tab Switcher UI

Render above the table, below the search bar. Two tabs: "Active Staff" with count badge, "Inactive" with count badge. Style the active tab with `border-b-2 border-primary-600 text-primary-700` and inactive with `text-gray-500 hover:text-gray-700`.

```tsx
<div className="flex gap-6 px-6 border-b border-gray-200">
  <button
    onClick={() => setActiveTab('active')}
    className={cn(
      "py-3 text-sm font-semibold border-b-2 transition-colors",
      activeTab === 'active'
        ? "border-primary-600 text-primary-700"
        : "border-transparent text-gray-500 hover:text-gray-700"
    )}
  >
    Active Staff
    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
      {activeUsers.length}
    </span>
  </button>
  <button
    onClick={() => setActiveTab('inactive')}
    className={cn(
      "py-3 text-sm font-semibold border-b-2 transition-colors",
      activeTab === 'inactive'
        ? "border-primary-600 text-primary-700"
        : "border-transparent text-gray-500 hover:text-gray-700"
    )}
  >
    Inactive
    {inactiveUsers.length > 0 && (
      <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
        {inactiveUsers.length}
      </span>
    )}
  </button>
</div>
```

#### E.4 Actions Column Updates

For **active** users, add a "Deactivate" action in the existing actions dropdown/area. Use `UserX` icon from Lucide (stroke-width 1.75, gray). Do **not** show the deactivate action for the currently logged-in admin (self-protection at UI level; Cloud Function also blocks this).

For **inactive** users, show a "Reactivate" action using `UserCheck` icon from Lucide. Also show a visual badge on inactive user rows:

```tsx
{user.status === 'deactivated' && (
  <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
    Inactive
  </span>
)}
```

#### E.5 Deactivation Confirmation Modal

This is a destructive action with compliance implications. The modal must make the consequences clear and require explicit confirmation.

```tsx
// DeactivateConfirmModal — renders when deactivatingUser is not null
<div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
        <UserX className="h-5 w-5 text-red-600" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900">Deactivate Account</h3>
        <p className="text-sm text-gray-500">{deactivatingUser.displayName}</p>
      </div>
    </div>

    <div className="space-y-3 mb-6">
      <p className="text-sm text-gray-700">This will immediately:</p>
      <ul className="text-sm text-gray-600 space-y-1.5 ml-4">
        <li className="flex items-start gap-2">
          <ShieldOff className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          Block this person from logging in
        </li>
        <li className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          Preserve all training records, grades, and certificates
        </li>
        <li className="flex items-start gap-2">
          <RotateCcw className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          This action can be reversed by an admin
        </li>
      </ul>

      <div className="mt-4">
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Type "{deactivatingUser.displayName}" to confirm
        </label>
        <input
          type="text"
          value={deactivateConfirmText}
          onChange={(e) => setDeactivateConfirmText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder={deactivatingUser.displayName}
        />
      </div>
    </div>

    <div className="flex gap-3">
      <Button
        variant="ghost"
        className="flex-1"
        onClick={() => {
          setDeactivatingUser(null);
          setDeactivateConfirmText('');
        }}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        className="flex-1"
        disabled={
          deactivateConfirmText !== deactivatingUser.displayName ||
          isDeactivating
        }
        onClick={handleDeactivate}
      >
        {isDeactivating ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deactivating...</>
        ) : (
          'Deactivate Account'
        )}
      </Button>
    </div>
  </div>
</div>
```

#### E.6 Reactivation Confirmation Modal

Simpler than deactivation — a standard confirm dialog:

```tsx
// ReactivateConfirmModal — renders when reactivatingUser is not null
<div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
        <UserCheck className="h-5 w-5 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900">Reactivate Account</h3>
        <p className="text-sm text-gray-500">{reactivatingUser.displayName}</p>
      </div>
    </div>

    <p className="text-sm text-gray-700 mb-6">
      This will restore login access for {reactivatingUser.displayName}.
      Their previous enrollments, grades, and certificates will remain intact.
      They will be able to log in with their existing credentials.
    </p>

    <div className="flex gap-3">
      <Button
        variant="ghost"
        className="flex-1"
        onClick={() => setReactivatingUser(null)}
      >
        Cancel
      </Button>
      <Button
        className="flex-1"
        disabled={isReactivating}
        onClick={handleReactivate}
      >
        {isReactivating ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Reactivating...</>
        ) : (
          'Reactivate Account'
        )}
      </Button>
    </div>
  </div>
</div>
```

#### E.7 Handler Functions

```typescript
const handleDeactivate = async () => {
  if (!deactivatingUser || isDeactivating) return;
  setIsDeactivating(true);

  try {
    await deactivateStaff(deactivatingUser.uid);
    addToast({
      type: 'success',
      title: `${deactivatingUser.displayName} deactivated`,
      message: 'Account access has been revoked. All records preserved.',
    });
    setDeactivatingUser(null);
    setDeactivateConfirmText('');
    await fetchData(); // Refresh the user list
  } catch (err: any) {
    const msg = err?.message || 'Failed to deactivate account.';
    addToast({ type: 'error', title: 'Deactivation failed', message: msg });
  } finally {
    setIsDeactivating(false);
  }
};

const handleReactivate = async () => {
  if (!reactivatingUser || isReactivating) return;
  setIsReactivating(true);

  try {
    await reactivateStaff(reactivatingUser.uid);
    addToast({
      type: 'success',
      title: `${reactivatingUser.displayName} reactivated`,
      message: 'Account access has been restored.',
    });
    setReactivatingUser(null);
    setActiveTab('active'); // Switch to active tab to show the restored user
    await fetchData();
  } catch (err: any) {
    const msg = err?.message || 'Failed to reactivate account.';
    addToast({ type: 'error', title: 'Reactivation failed', message: msg });
  } finally {
    setIsReactivating(false);
  }
};
```

#### E.8 fetchData Update

The existing `fetchData` callback maps Firestore docs to `User` objects. Add the `status` field to the mapping:

```typescript
// In the usersSnap.docs.map() call, add:
status: doc.data().status || 'active',   // backward compat: missing = active
deactivatedAt: doc.data().deactivatedAt?.toDate?.()?.toISOString(),
deactivatedBy: doc.data().deactivatedBy,
```

**Verification:**
1. Active tab shows only users without `status: 'deactivated'`
2. Deactivate a test user → they move to Inactive tab
3. Reactivate from Inactive tab → they return to Active tab
4. Self-deactivation button is not shown for the current admin
5. Toast messages appear for both operations
6. Page refreshes correctly after each operation

---

### F. Firestore Security Rules [VERIFY ONLY — `firestore.rules`]

**Estimate:** 15 minutes | **Risk:** None (no changes needed)

The existing `users` collection rules already permit:
- Admin read of all user documents ✓
- Admin update of user documents ✓
- The Cloud Functions use the Admin SDK, which bypasses security rules entirely ✓

**No rule changes are required.** The deactivation writes happen via Cloud Functions (Admin SDK), and the client-side reads already work for admins.

**Verify:** Read through the `match /users/{userId}` block in `firestore.rules` and confirm admin has read + update access.

---

### G. Downstream Filter: Skill Gap Dashboard [MODIFY `src/services/skillGapService.ts`]

**Estimate:** 15 minutes | **Risk:** Low

The Skill Gap Dashboard aggregates compliance data across all staff. Deactivated users should be excluded from active compliance calculations (they'd drag down completion rates for staff who no longer work there).

In `skillGapService.ts`, wherever the `filteredStaff` or `staffUsers` array is built from the users collection, add a filter:

```typescript
const staffUsers = allUsers.filter(u =>
  u.role === 'staff' && u.status !== 'deactivated'
);
```

**Verification:** Deactivate a test user → Skill Gap Dashboard recalculates without them.

---

### H. Downstream Filter: Cohort Enrollment [VERIFY `src/services/cohortService.ts`]

**Estimate:** 10 minutes | **Risk:** Low

When bulk enrollment runs against a cohort's filter criteria, it should skip deactivated users. Verify that the user query in the bulk enrollment path filters on status. If it doesn't, add:

```typescript
// In the query that resolves cohort members:
.where('status', 'in', ['active', undefined])
// OR filter client-side after fetch:
.filter(u => u.status !== 'deactivated')
```

**Note:** Firestore `where('status', 'in', [...])` does not match documents missing the field. The safest approach is client-side filtering since existing documents lack the `status` field. Use: `.filter(u => (u.status || 'active') !== 'deactivated')`.

---

## Files In Scope

| Action | File | Changes |
| :----- | :--- | :------ |
| MODIFY | `functions/src/types.ts` | + `status`, `deactivatedAt`, `deactivatedBy`, `reactivatedAt`, `reactivatedBy` on User; + 2 audit action types |
| MODIFY | `src/services/auditService.ts` | + `USER_DEACTIVATE`, `USER_REACTIVATE` action types |
| MODIFY | `functions/src/index.ts` | + `deactivateUser` Cloud Function, + `reactivateUser` Cloud Function |
| CREATE | `src/services/userManagementService.ts` | Client-side callable wrappers |
| MODIFY | `src/pages/UserManagement.tsx` | Active/Inactive tabs, deactivation modal, reactivation modal, action buttons |
| MODIFY | `src/services/skillGapService.ts` | Exclude deactivated users from compliance calculations |
| VERIFY | `src/services/cohortService.ts` | Confirm bulk enrollment skips deactivated users |
| VERIFY | `firestore.rules` | Confirm admin read/update on users collection |

## Out of Scope (Do Not Touch)

- AuthContext (`src/contexts/AuthContext.tsx`) — no changes needed
- Existing 6+ Cloud Functions (onGradeCreate, onGradeUpdate, onEnrollmentUpdate, onProgressUpdate, onRemediationUpdate, calculateCourseGrade, createInvitedUser, validateInvitationToken, setUserRole, createDirectAccount, generateCertificate)
- Invitation pipeline (invitationService.ts, Invitations.tsx, AcceptInvite.tsx)
- Course Builder, Module Builder, Course Player, Grade Management
- Guide 11 auto-save work
- Certificate generation or CE Credit Vault
- Enrollment documents — in-progress enrollments are frozen, not cancelled
- Firestore security rules (verify only, no modifications)

---

## Ripple Effect Analysis

| Change | Affected Area | Risk | Mitigation |
| :----- | :------------ | :--- | :--------- |
| New optional fields on `User` | Every component reading user profiles | NONE | All fields optional, `undefined` = `active` |
| Two new Cloud Functions | `firebase deploy --only functions` redeploys all | LOW | Additive, no existing function modified |
| Auth `disabled: true` | Target user's active sessions | LOW | Firebase Auth revokes tokens on disable; active sessions end at next token refresh (~1 hour max, immediate on next API call) |
| UserManagement tab restructure | Admin workflow for viewing staff | LOW | Existing table structure preserved within each tab |
| Skill Gap Dashboard filter | Compliance percentage calculations | LOW | Deactivated users excluded = more accurate rates |
| Cohort bulk enrollment filter | Who receives bulk enrollments | LOW | Prevents enrolling departed staff |

---

## Verification Checklist

### Cloud Functions
- [ ] `deactivateUser` rejects unauthenticated calls
- [ ] `deactivateUser` rejects non-admin callers
- [ ] `deactivateUser` rejects self-deactivation (`targetUid === auth.uid`)
- [ ] `deactivateUser` rejects if target is the last active admin
- [ ] `deactivateUser` rejects if target is already deactivated
- [ ] `deactivateUser` succeeds: Auth account disabled, Firestore profile updated, audit log created
- [ ] `reactivateUser` rejects if target is not deactivated
- [ ] `reactivateUser` succeeds: Auth account re-enabled, Firestore profile updated, audit log created

### UI
- [ ] Active Staff tab shows only non-deactivated users (including those with no `status` field)
- [ ] Inactive tab shows only deactivated users with count badge
- [ ] Deactivate button is hidden for the currently logged-in admin
- [ ] Deactivation modal requires typing the user's full name to confirm
- [ ] Deactivation modal shows consequences clearly (login blocked, records preserved, reversible)
- [ ] After deactivation: user moves to Inactive tab, toast confirms success
- [ ] Reactivation modal is simpler (standard confirm)
- [ ] After reactivation: user moves to Active tab, tab switches automatically
- [ ] Search filter works across both tabs

### Data Integrity
- [ ] Deactivated user's enrollments are untouched (frozen, not deleted)
- [ ] Deactivated user's grades remain queryable by instructors/admins
- [ ] Deactivated user's certificates remain valid and downloadable
- [ ] Deactivated user's audit log entries are intact
- [ ] Deactivated user's policy signatures are intact
- [ ] Audit Logs page shows `USER_DEACTIVATE` and `USER_REACTIVATE` entries with actor and target metadata

### Login Behavior
- [ ] Deactivated user cannot log in (Firebase Auth returns `auth/user-disabled`)
- [ ] Error message displayed is the existing mapped message: "This account has been disabled."
- [ ] Reactivated user can log in with their previous credentials

### Downstream
- [ ] Skill Gap Dashboard excludes deactivated users from compliance calculations
- [ ] Cohort bulk enrollment skips deactivated users

---

## Execution Order

1. **Step 1:** Types (A) + Audit types (B) — foundation, no risk
2. **Step 2:** Cloud Functions (C) — deploy and test in isolation
3. **Step 3:** Client service (D) — thin wrapper, test with manual calls
4. **Step 4:** UserManagement UI (E) — depends on steps 1–3
5. **Step 5:** Downstream filters (G, H) — independent of UI work
6. **Step 6:** End-to-end verification — full walkthrough with all pieces connected
