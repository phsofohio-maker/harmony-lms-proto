# GUIDE 15

# Staff Management

| Estimate | Priority | Phase |
| :------- | :------- | :---- |
| 4–5 Days | CRITICAL | Phase 3 (Operations) |

---

## Root Cause

Staff management in Parrish HALO is front-loaded: account creation and enrollment work well, but once someone is in the system, there's no way to manage them. Four capabilities are missing:

1. **Edit staff profile** — No UI to update name, department, or job title. The only path is direct Firestore Console edits.
2. **Change role from the UI** — The `setUserRole` Cloud Function works (updates JWT claims + Firestore profile + audit log), but there's no admin UI to trigger it.
3. **Update license information** — The system displays license status beautifully and the LicenseGate blocks expired staff, but there's no way to update `licenseNumber` or `licenseExpiry` through the app.
4. **Deactivate/reactivate staff** — No mechanism to remove departed staff. Orphaned active accounts are a CMS compliance finding.

All four share a common surface: the UserManagement page. This guide consolidates them into a single `EditStaffModal` and a deactivation flow, turning the Staff Compliance Directory from a read-only display into a real management tool.

---

## Architectural Decisions

### Profile edits vs. role changes — two different paths

Profile field updates (displayName, department, jobTitle, licenseNumber, licenseExpiry) can be written directly to Firestore from the client. The existing security rules already permit this:

```
match /users/{userId} {
  allow update: if isAdmin() || (
    isOwner(userId) &&
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'uid'])
  );
}
```

Admins have unrestricted update access. No Cloud Function needed.

Role changes **must** route through the existing `setUserRole` Cloud Function because changing a role requires updating JWT custom claims via `admin.auth().setCustomUserClaims()` — a server-side-only API. The Cloud Function also syncs the Firestore profile role field and creates an audit log. This function already exists and is tested; we just need UI to call it.

Deactivation requires `admin.auth().updateUser(uid, { disabled: true })` — another server-side-only API. This requires **new** Cloud Functions (`deactivateUser`, `reactivateUser`).

### License verification — manual now, API later

License updates are manual admin entry in this guide. The admin verifies the license through Nursys QuickConfirm (free web lookup) or by checking the nurse's renewal paperwork, then enters the data. Automated verification via the Nursys e-Notify API is deferred to a future Phase 4 ADR — it requires an institutional account, sensitive PII handling (SSN last 4, DOB), and 90-day credential rotation that would triple this guide's scope.

### Self-service — explicitly excluded

Staff cannot self-edit. All profile management is admin-only. This matches Parrish's operational model: office staff maintain records, clinical staff focus on patient care. A "My Profile" view-only page is a future nice-to-have, not part of this guide.

---

## The Contract

### New Types

```typescript
// ADD to AuditActionType union in both:
//   - functions/src/types.ts
//   - src/services/auditService.ts

| 'USER_PROFILE_UPDATE'
| 'USER_DEACTIVATE'
| 'USER_REACTIVATE'
```

```typescript
// ADD optional fields to User interface in functions/src/types.ts

export interface User {
  // ... existing fields unchanged ...
  status?: 'active' | 'deactivated';       // undefined treated as 'active'
  deactivatedAt?: string;
  deactivatedBy?: string;
  reactivatedAt?: string;
  reactivatedBy?: string;
}
```

### New Cloud Functions

```typescript
// ADD to functions/src/index.ts
export const deactivateUser = onCall(async (request) => { ... });
export const reactivateUser = onCall(async (request) => { ... });
// NOTE: updateStaffProfile is NOT a Cloud Function — it's a client-side Firestore write
// NOTE: setUserRole ALREADY EXISTS — we only build UI to call it
```

### New Service

```typescript
// CREATE src/services/staffService.ts
export async function updateStaffProfile(targetUid: string, updates: StaffProfileUpdate, actor: Actor): Promise<void>
export async function changeStaffRole(targetUid: string, newRole: UserRoleType, actor: Actor): Promise<void>
export async function deactivateStaff(targetUid: string): Promise<void>
export async function reactivateStaff(targetUid: string): Promise<void>
```

---

## Deliverables

### A. Type Changes [MODIFY `functions/src/types.ts`]

**Estimate:** 10 minutes | **Risk:** None

Add `status`, `deactivatedAt`, `deactivatedBy`, `reactivatedAt`, `reactivatedBy` as optional fields to the `User` interface.

Add `USER_PROFILE_UPDATE`, `USER_DEACTIVATE`, and `USER_REACTIVATE` to the `AuditActionType` union.

**Verification:** TypeScript compiles clean. No existing code breaks.

---

### B. Audit Action Types [MODIFY `src/services/auditService.ts`]

**Estimate:** 5 minutes | **Risk:** None

Add `'USER_PROFILE_UPDATE'`, `'USER_DEACTIVATE'`, and `'USER_REACTIVATE'` to the client-side `AuditActionType` union.

**Verification:** TypeScript compiles clean.

---

### C. Staff Service [CREATE `src/services/staffService.ts`]

**Estimate:** 1–2 hours | **Risk:** Low

This is the single service that owns all staff management operations. It coordinates between direct Firestore writes (profile updates), existing Cloud Functions (role changes), and new Cloud Functions (deactivation).

```typescript
/**
 * Staff Management Service
 *
 * Admin operations for the staff lifecycle: profile editing,
 * role changes, license updates, deactivation, and reactivation.
 *
 * Architecture:
 * - Profile fields (name, dept, title, license): direct Firestore writes
 *   (security rules allow admin update on users collection)
 * - Role changes: route through existing setUserRole Cloud Function
 *   (JWT custom claims require server-side Admin SDK)
 * - Deactivation/reactivation: route through new Cloud Functions
 *   (Firebase Auth disable/enable requires server-side Admin SDK)
 *
 * @module services/staffService
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import { UserRoleType } from '../functions/src/types';
import { auditService, AuditActionType } from './auditService';

// ============================================
// TYPES
// ============================================

export interface StaffProfileUpdate {
  displayName?: string;
  department?: string;
  jobTitle?: string;
  licenseNumber?: string | null;    // null to clear
  licenseExpiry?: string | null;    // ISO date string, null to clear
}

interface Actor {
  uid: string;
  displayName: string;
}

// ============================================
// PROFILE UPDATES (Client-side Firestore write)
// ============================================

/**
 * Updates a staff member's profile fields.
 * Direct Firestore write — security rules allow admin to update any user doc.
 * Does NOT touch role or uid (security rules block those fields for non-admin self-edits).
 *
 * @throws Error if Firestore write fails
 */
export async function updateStaffProfile(
  targetUid: string,
  updates: StaffProfileUpdate,
  actor: Actor
): Promise<void> {
  // Strip undefined values (Firestore invariant)
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      // Convert null to deleteField() sentinel? No — null is a valid Firestore value.
      // A null licenseNumber means "no license on file" which is semantically correct.
      sanitized[key] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) return; // Nothing to update

  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });

  // Audit log — capture what changed
  const changeDescription = Object.entries(sanitized)
    .filter(([key]) => key !== 'updatedAt')
    .map(([key, val]) => `${key}: "${val}"`)
    .join(', ');

  await auditService.logToFirestore(
    actor.uid,
    actor.displayName,
    'USER_PROFILE_UPDATE' as AuditActionType,
    targetUid,
    `Profile updated: ${changeDescription}`,
    { updates: sanitized }
  );
}

// ============================================
// ROLE CHANGES (Existing Cloud Function)
// ============================================

/**
 * Changes a staff member's role.
 * Routes through the existing setUserRole Cloud Function which:
 * 1. Updates JWT custom claims (source of truth for security rules)
 * 2. Syncs Firestore profile role field
 * 3. Creates audit log entry
 *
 * The target user must sign out and back in for the new role to take effect
 * (JWT claims are baked into the auth token at sign-in time).
 */
export async function changeStaffRole(
  targetUid: string,
  newRole: UserRoleType
): Promise<void> {
  const functions = getFunctions();
  const callable = httpsCallable<
    { targetUid: string; role: string },
    { success: boolean; uid: string; role: string }
  >(functions, 'setUserRole');

  await callable({ targetUid, role: newRole });
}

// ============================================
// DEACTIVATION / REACTIVATION (New Cloud Functions)
// ============================================

/**
 * Deactivates a staff account.
 * Disables Firebase Auth (blocks login) and flags Firestore profile.
 * All historical data (enrollments, grades, certificates) is preserved.
 */
export async function deactivateStaff(targetUid: string): Promise<void> {
  const functions = getFunctions();
  const callable = httpsCallable<
    { targetUid: string },
    { success: boolean; uid: string }
  >(functions, 'deactivateUser');

  await callable({ targetUid });
}

/**
 * Reactivates a previously deactivated staff account.
 * Re-enables Firebase Auth login and restores active status.
 */
export async function reactivateStaff(targetUid: string): Promise<void> {
  const functions = getFunctions();
  const callable = httpsCallable<
    { targetUid: string },
    { success: boolean; uid: string }
  >(functions, 'reactivateUser');

  await callable({ targetUid });
}
```

**Verification:** Import in a test file, confirm TypeScript compiles clean.

---

### D. Cloud Functions: `deactivateUser` and `reactivateUser` [MODIFY `functions/src/index.ts`]

**Estimate:** 2–3 hours | **Risk:** MEDIUM

#### D.1 `deactivateUser`

```typescript
export const deactivateUser = onCall(async (request) => {
  // 1. Auth + role gates (admin only)
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  if (request.auth.token.role !== "admin") throw new HttpsError("permission-denied", "Only admins can deactivate accounts.");

  const { targetUid } = request.data;
  if (!targetUid || typeof targetUid !== "string") throw new HttpsError("invalid-argument", "targetUid is required.");

  // 2. Self-protection
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "You cannot deactivate your own account.");
  }

  // 3. Last-admin protection
  const adminsSnapshot = await db.collection("users").where("role", "==", "admin").get();
  const activeAdmins = adminsSnapshot.docs.filter(d => d.data().status !== 'deactivated' && d.id !== targetUid);
  if (activeAdmins.length === 0) {
    throw new HttpsError("failed-precondition", "Cannot deactivate the last active admin.");
  }

  // 4. Verify target exists and is not already deactivated
  const targetProfile = await db.collection("users").doc(targetUid).get();
  if (!targetProfile.exists) throw new HttpsError("not-found", "User not found.");
  if (targetProfile.data()?.status === 'deactivated') throw new HttpsError("failed-precondition", "User is already deactivated.");

  try {
    // 5. Disable Auth (first — fail-fast before Firestore)
    await admin.auth().updateUser(targetUid, { disabled: true });

    // 6. Update Firestore profile
    await db.collection("users").doc(targetUid).update(stripUndefined({
      status: 'deactivated',
      deactivatedAt: admin.firestore.Timestamp.now(),
      deactivatedBy: request.auth.uid,
      updatedAt: admin.firestore.Timestamp.now(),
    }));

    // 7. Audit log
    const targetData = targetProfile.data();
    await createAuditLog(
      request.auth.uid,
      request.auth.token.name || "Unknown",
      "USER_DEACTIVATE",
      targetUid,
      `Deactivated ${targetData?.displayName || targetUid} (${targetData?.email || 'unknown'})`,
      { targetEmail: targetData?.email, targetRole: targetData?.role } as Record<string, unknown>
    );

    return { success: true, uid: targetUid };
  } catch (error) {
    logger.error("Failed to deactivate user:", error);
    throw new HttpsError("internal", "Failed to deactivate user account.");
  }
});
```

#### D.2 `reactivateUser`

Same structure, inverse operations:
- Reject if target is NOT deactivated
- `admin.auth().updateUser(targetUid, { disabled: false })`
- Set `status: 'active'`, `reactivatedAt`, `reactivatedBy`
- Audit log with `USER_REACTIVATE`

**Key design decisions:**
- `stripUndefined` applied before every Firestore write
- Firebase Auth operation runs first (fail-fast: if Auth fails, Firestore is never updated)
- `createAuditLog` uses the existing server-side helper
- Metadata captures target identity for audit readability

**Verification:**
1. `cd functions && npm run build` compiles clean
2. `firebase deploy --only functions` deploys without errors
3. Non-admin call returns `permission-denied`
4. Self-deactivation returns `failed-precondition`
5. Last-admin deactivation returns `failed-precondition`

---

### E. EditStaffModal [MODIFY `src/pages/UserManagement.tsx`]

**Estimate:** 4–6 hours | **Risk:** MEDIUM (largest deliverable)

This is the central piece of the guide. A single modal that handles profile editing, role changes, and license management for a selected user.

#### E.1 Modal State

```typescript
const [editingUser, setEditingUser] = useState<User | null>(null);
const [editForm, setEditForm] = useState({
  displayName: '',
  department: '',
  jobTitle: '',
  licenseNumber: '',
  licenseExpiry: '',
  role: '' as UserRoleType,
});
const [isSaving, setIsSaving] = useState(false);
const [roleChangeWarning, setRoleChangeWarning] = useState(false);
```

When `editingUser` is set, populate `editForm` from the user's current values.

#### E.2 Modal Layout

The modal is organized into three sections, each visually separated:

**Section 1: Identity**
- Display Name — text input, required, min 2 chars
- Department — text input, optional
- Job Title — text input, optional

**Section 2: System Role**
- Role — select dropdown (Staff, Instructor, Content Author, Admin)
- When role differs from current, show an amber warning: "Role changes require the user to sign out and back in. JWT claims update on next login."
- Admin self-role-change is blocked at UI level

**Section 3: License Information**
- License Number — text input, optional
- License Expiry — date input, optional
- Show current license status badge inline (Valid / Expiring Soon / Expired / N/A)
- When expiry date is entered, calculate and display days remaining in real-time
- "Clear License" button sets both fields to null (for non-clinical roles)

**Footer:**
- Cancel button
- Save Changes button (disabled if no changes detected)

#### E.3 Save Handler

```typescript
const handleSave = async () => {
  if (!editingUser || !currentUser || isSaving) return;
  setIsSaving(true);

  try {
    const actor = { uid: currentUser.uid, displayName: currentUser.displayName };

    // 1. Profile fields (direct Firestore write)
    const profileUpdates: StaffProfileUpdate = {};
    if (editForm.displayName !== editingUser.displayName) profileUpdates.displayName = editForm.displayName;
    if (editForm.department !== (editingUser.department || '')) profileUpdates.department = editForm.department || undefined;
    if (editForm.jobTitle !== (editingUser.jobTitle || '')) profileUpdates.jobTitle = editForm.jobTitle || undefined;
    if (editForm.licenseNumber !== (editingUser.licenseNumber || '')) {
      profileUpdates.licenseNumber = editForm.licenseNumber || null;
    }
    if (editForm.licenseExpiry !== (editingUser.licenseExpiry || '')) {
      profileUpdates.licenseExpiry = editForm.licenseExpiry || null;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await updateStaffProfile(editingUser.uid, profileUpdates, actor);
    }

    // 2. Role change (Cloud Function — separate operation)
    if (editForm.role !== editingUser.role) {
      await changeStaffRole(editingUser.uid, editForm.role);
    }

    // 3. Success feedback
    const changes = [];
    if (Object.keys(profileUpdates).length > 0) changes.push('profile updated');
    if (editForm.role !== editingUser.role) changes.push(`role changed to ${editForm.role}`);

    addToast({
      type: 'success',
      title: `${editForm.displayName} updated`,
      message: changes.join(', ') + (editForm.role !== editingUser.role
        ? '. User must sign out and back in for role change to take effect.'
        : ''),
    });

    setEditingUser(null);
    await fetchData();
  } catch (err: any) {
    addToast({ type: 'error', title: 'Update failed', message: err?.message || 'An unexpected error occurred.' });
  } finally {
    setIsSaving(false);
  }
};
```

**Key design decisions:**
- Profile updates and role changes are separate operations. If the profile update succeeds but the role change fails, the profile changes persist (partial success is better than full rollback for independent fields).
- The role change warning is purely informational — the admin must acknowledge it but it doesn't block saving.
- Dirty-state detection: Save button only enables when at least one field differs from the original.
- The save handler compares each field against the original user to only write changed fields.

#### E.4 Actions Column Update

Replace the current Actions column (which only has an Enroll button) with a more capable layout:

```tsx
<td className="px-6 py-4 text-right">
  <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
    <Button variant="outline" size="sm" className="gap-1"
      onClick={() => setEditingUser(user)}>
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Button>
    <Button variant="outline" size="sm" className="gap-1"
      onClick={() => setEnrollModalUserId(user.uid)}>
      <BookOpen className="h-3.5 w-3.5" />
      Enroll
    </Button>
    {/* Deactivate — hidden for self and in inactive tab */}
    {activeTab === 'active' && user.uid !== currentUser?.uid && (
      <Button variant="ghost" size="sm"
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
        onClick={() => setDeactivatingUser(user)}>
        <UserX className="h-3.5 w-3.5" />
      </Button>
    )}
    {/* Reactivate — only in inactive tab */}
    {activeTab === 'inactive' && (
      <Button variant="outline" size="sm" className="gap-1"
        onClick={() => setReactivatingUser(user)}>
        <UserCheck className="h-3.5 w-3.5" />
        Reactivate
      </Button>
    )}
  </div>
</td>
```

#### E.5 Active/Inactive Tabs

Add a tabbed interface above the table. Two tabs: "Active Staff" (with count badge) and "Inactive" (with count badge in amber when > 0).

```typescript
const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

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

Tab styling: active tab gets `border-b-2 border-primary-600 text-primary-700`, inactive gets `border-transparent text-gray-500 hover:text-gray-700`.

#### E.6 Deactivation Confirmation Modal

Destructive action requiring typed name confirmation:
- Shows user's name and explains consequences (login blocked, records preserved, reversible)
- Requires typing the user's full display name to enable the Deactivate button
- Calls `deactivateStaff()` → toast → refresh list

#### E.7 Reactivation Confirmation Modal

Standard confirm dialog (simpler than deactivation):
- Explains that login access will be restored
- Calls `reactivateStaff()` → toast → switches to Active tab → refresh list

#### E.8 fetchData Update

Add `status` to the Firestore-to-User mapping in the existing `fetchData` callback:

```typescript
status: doc.data().status || 'active',
deactivatedAt: doc.data().deactivatedAt?.toDate?.()?.toISOString(),
deactivatedBy: doc.data().deactivatedBy,
```

**Verification:**
1. Click Edit on any user → modal opens pre-populated with current values
2. Change name → Save → toast confirms, list refreshes with new name
3. Change role → amber warning appears, Save → toast includes sign-out reminder
4. Update license expiry → status badge recalculates in real-time
5. Clear license → license fields set to null, status shows N/A
6. No changes → Save button stays disabled
7. Active/Inactive tabs filter correctly
8. Deactivate → typed confirmation → user moves to Inactive tab
9. Reactivate → confirm → user moves to Active tab

---

### F. Downstream Filters [MODIFY `src/services/skillGapService.ts`]

**Estimate:** 15 minutes | **Risk:** Low

Exclude deactivated users from Skill Gap Dashboard compliance calculations:

```typescript
const staffUsers = allUsers.filter(u =>
  u.role === 'staff' && u.status !== 'deactivated'
);
```

**Verification:** Deactivate a test user → Skill Gap Dashboard recalculates without them.

---

### G. Downstream Filter: Cohort Enrollment [VERIFY `src/services/cohortService.ts`]

**Estimate:** 10 minutes | **Risk:** Low

Verify that bulk enrollment skips deactivated users. Since existing documents lack the `status` field, use client-side filtering:

```typescript
.filter(u => (u.status || 'active') !== 'deactivated')
```

---

### H. Firestore Security Rules [VERIFY ONLY — `firestore.rules`]

**Estimate:** 10 minutes | **Risk:** None

Confirm existing rules already support all operations:
- `allow update: if isAdmin()` on users collection — covers profile edits ✓
- Cloud Functions use Admin SDK — bypasses rules entirely for deactivation ✓
- No new rules needed

---

## Files In Scope

| Action | File | Changes |
| :----- | :--- | :------ |
| MODIFY | `functions/src/types.ts` | + User status fields, + 3 audit action types |
| MODIFY | `src/services/auditService.ts` | + 3 audit action types |
| CREATE | `src/services/staffService.ts` | Profile update, role change, deactivate, reactivate |
| MODIFY | `functions/src/index.ts` | + `deactivateUser`, + `reactivateUser` Cloud Functions |
| MODIFY | `src/pages/UserManagement.tsx` | + EditStaffModal, + Active/Inactive tabs, + Deactivate/Reactivate modals, + Edit/Deactivate action buttons |
| MODIFY | `src/services/skillGapService.ts` | Exclude deactivated users from compliance stats |
| VERIFY | `src/services/cohortService.ts` | Confirm bulk enrollment skips deactivated |
| VERIFY | `firestore.rules` | Confirm admin update on users collection |

## Out of Scope (Do Not Touch)

- AuthContext (`src/contexts/AuthContext.tsx`)
- Existing Cloud Functions (onGradeCreate, onGradeUpdate, onEnrollmentUpdate, onProgressUpdate, onRemediationUpdate, calculateCourseGrade, createInvitedUser, validateInvitationToken, setUserRole, createDirectAccount, generateCertificate)
- Invitation pipeline (invitationService.ts, Invitations.tsx, AcceptInvite.tsx)
- Course Builder, Module Builder, Course Player, Grade Management
- Enrollment documents — in-progress enrollments frozen on deactivation, not cancelled
- Firestore security rules (verify only)
- Guide 11 auto-save work
- Staff self-service / "My Profile" page
- Nursys e-Notify API integration (deferred to Phase 4 ADR)
- Firebase Auth `displayName` sync (Firestore profile is the source of truth, Auth displayName is not used by the app)

---

## Ripple Effect Analysis

| Change | Affected Area | Risk | Mitigation |
| :----- | :------------ | :--- | :--------- |
| New optional User fields | All profile readers | NONE | All optional, undefined = active |
| Two new Cloud Functions | `firebase deploy --only functions` | LOW | Additive, no existing fn modified |
| staffService.ts | New file, no conflicts | NONE | No existing service modified |
| Profile Firestore writes | User docs | LOW | Admin-only, security rules already permit |
| Role change via setUserRole | JWT claims + Firestore + audit | LOW | Existing CF, only adding UI |
| Auth disabled: true | Target user sessions | LOW | Token revoked on next refresh |
| UserManagement restructure | Admin workflow | MEDIUM | Existing table structure preserved within tabs |
| Skill Gap Dashboard filter | Compliance percentages | LOW | More accurate after excluding departed |

---

## Verification Checklist

### Profile Editing
- [ ] Edit button appears for each user row on hover
- [ ] Modal opens pre-populated with user's current data
- [ ] Changing display name and saving updates Firestore
- [ ] Changing department and saving updates Firestore
- [ ] Changing job title and saving updates Firestore
- [ ] Save button disabled when no fields changed (dirty-state detection)
- [ ] Audit log entry created with USER_PROFILE_UPDATE and changed fields in metadata

### Role Changes
- [ ] Changing role in the dropdown shows amber warning about sign-out requirement
- [ ] Saving a role change calls setUserRole Cloud Function
- [ ] JWT custom claims update (verify via Firebase Console → Authentication → user → custom claims)
- [ ] Firestore profile role field updates in sync
- [ ] Toast message includes sign-out reminder
- [ ] Admin cannot change their own role to a non-admin role (or: warning shown)
- [ ] Audit log entry created with USER_ROLE_CHANGE

### License Management
- [ ] License number and expiry fields editable in modal
- [ ] License status badge (Valid/Expiring/Expired/N/A) recalculates live as expiry date changes
- [ ] Clearing license fields sets them to null, status shows N/A
- [ ] Entering a past expiry date shows Expired badge immediately
- [ ] Entering an expiry within 30 days shows Expiring Soon badge
- [ ] Audit log captures license field changes

### Deactivation
- [ ] Deactivate button hidden for current admin's own row
- [ ] Deactivation modal requires typing user's full name
- [ ] After deactivation: user moves to Inactive tab, toast confirms
- [ ] Deactivated user cannot log in (auth/user-disabled)
- [ ] Error message: "This account has been disabled."
- [ ] Deactivated user's enrollments, grades, certificates, audit logs are untouched
- [ ] Last-admin deactivation is blocked with descriptive error
- [ ] Audit log entry with USER_DEACTIVATE

### Reactivation
- [ ] Reactivate button appears in Inactive tab
- [ ] After reactivation: user moves to Active tab, tab auto-switches
- [ ] Reactivated user can log in with previous credentials
- [ ] Audit log entry with USER_REACTIVATE

### Downstream
- [ ] Skill Gap Dashboard excludes deactivated users
- [ ] Cohort bulk enrollment skips deactivated users

---

## Execution Order

1. **Step 1:** Types (A) + Audit types (B) — foundation, zero risk
2. **Step 2:** Staff service (C) — new file, no conflicts, independently testable
3. **Step 3:** Cloud Functions (D) — deploy and test deactivation/reactivation in isolation
4. **Step 4:** UserManagement UI (E) — depends on steps 1–3
   - Sub-step 4a: EditStaffModal (profile + role + license)
   - Sub-step 4b: Active/Inactive tabs + deactivation/reactivation modals
   - Sub-step 4c: Actions column restructure
5. **Step 5:** Downstream filters (F, G) — independent of UI
6. **Step 6:** End-to-end verification — full walkthrough

---

## Future: Nursys e-Notify Integration (Phase 4 ADR)

For reference only — not part of this guide's scope.

Nursys e-Notify is a free NCSBN service that provides automated nurse license status updates to institutions. It offers a JSON API that can:
- Maintain a nurse list aligned with the institution's records
- Pull license status, expiry, and discipline data for enrolled nurses
- Receive real-time notifications when license status changes

Integration would require:
- Parrish registers as an institution at nursys.com
- A Cloud Function that syncs the HALO user list with Nursys e-Notify
- Storage of SSN last 4 digits and DOB (required for Nursys enrollment verification — sensitive PII requiring encryption at rest)
- API credential rotation every 90 days (scheduled Cloud Function)
- No test environment exists (must test against production Nursys)

This is a 2–3 week effort with its own ADR for PII handling. It would replace manual license entry with automated, primary-source-equivalent verification.
