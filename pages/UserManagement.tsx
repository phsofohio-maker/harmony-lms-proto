/**
 * User Management Page - Firestore Integration
 *
 * Converted from template's MOCK_USERS/props version to use Firestore.
 * Fetches users from Firestore 'users' collection, enrollments from
 * 'enrollments' collection, and courses via useCourses hook.
 *
 * @module pages/UserManagement
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User, Enrollment, Course, UserRoleType } from '../functions/src/types';
import { Users, Search, MoreVertical, ShieldCheck, Mail, PlusCircle, Book, Loader2, RefreshCw, AlertCircle, UserPlus, KeyRound, Copy, RefreshCcw, Check, X, UserX, UserCheck, ShieldOff, FileText, RotateCcw, Pencil, IdCard, Briefcase, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useCourses } from '../hooks/useCourses';
import { createEnrollment, getUserEnrollments } from '../services/enrollmentService';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  deactivateStaff,
  reactivateStaff,
  updateStaffProfile,
  changeStaffRole,
  StaffProfileUpdate,
} from '../services/userManagementService';

const TEMP_PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generateTempPassword = (): string => {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => TEMP_PW_CHARS[b % TEMP_PW_CHARS.length]).join('');
};

interface CreateAccountModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({ onClose, onCreated }) => {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRoleType>('staff');
  const [department, setDepartment] = useState('');
  const [tempPassword, setTempPassword] = useState(() => generateTempPassword());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; password: string; role: UserRoleType } | null>(null);
  const [copied, setCopied] = useState<'password' | 'credentials' | null>(null);

  const copyToClipboard = async (text: string, label: 'password' | 'credentials') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts; silently ignore.
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (displayName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (tempPassword.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const functions = getFunctions();
      const callable = httpsCallable<
        { email: string; displayName: string; role: UserRoleType; department?: string; temporaryPassword: string },
        { success: boolean; uid: string; email: string; role: UserRoleType }
      >(functions, 'createDirectAccount');

      const result = await callable({
        email: email.trim(),
        displayName: displayName.trim(),
        role,
        department: department.trim() || undefined,
        temporaryPassword: tempPassword,
      });

      setSuccess({ email: result.data.email, password: tempPassword, role: result.data.role });
      addToast({ type: 'success', title: `${displayName.trim()} account created`, message: `Provisioned as ${role}.` });
      onCreated();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 animate-in zoom-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary-600" />
              {success ? 'Account Created' : 'Create Account (Direct)'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {success
                ? 'Hand these credentials to the new user. They will be required to set a permanent password on first login.'
                : 'Provision a new account without sending an invitation email. Use this when email delivery is uncertain.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-400"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Temporary credentials</p>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-mono text-gray-900">{success.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Password</dt>
                  <dd className="font-mono text-gray-900">{success.password}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Role</dt>
                  <dd className="font-mono text-gray-900">{success.role}</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => copyToClipboard(
                  `Email: ${success.email}\nTemporary password: ${success.password}\nRole: ${success.role}`,
                  'credentials',
                )}
              >
                {copied === 'credentials' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'credentials' ? 'Copied' : 'Copy Credentials'}
              </Button>
              <Button className="flex-1" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="ca-email">Email</label>
              <input
                id="ca-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                placeholder="nurse@harmonyhca.org"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="ca-name">Full Name</label>
              <input
                id="ca-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                placeholder="Jane Doe, RN"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="ca-role">Role</label>
                <select
                  id="ca-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRoleType)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 bg-white"
                >
                  <option value="staff">Staff</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                  <option value="content_author">Content Author</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="ca-dept">Department</label>
                <input
                  id="ca-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="ca-pw">Temporary Password</label>
              <div className="flex gap-2">
                <input
                  id="ca-pw"
                  type="text"
                  value={tempPassword}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(tempPassword, 'password')}
                  disabled={submitting}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  title="Copy password"
                >
                  {copied === 'password' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTempPassword(generateTempPassword())}
                  disabled={submitting}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  title="Regenerate password"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                User will be required to set a permanent password on first login.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmit} isLoading={submitting} disabled={submitting}>
                Create Account
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Edit Staff Modal (Guide 15)
// ============================================
// Single modal for profile fields, role changes, and license information.
// Profile fields write directly to Firestore; role changes route through
// the existing `setUserRole` Cloud Function. Both run as independent ops
// — partial success is acceptable (profile saves even if role fails).

interface EditStaffModalProps {
  user: User;
  /** Current admin's UID — used to block self-role-change. */
  currentUserUid: string;
  onClose: () => void;
  onSaved: () => void;
}

const ROLE_OPTIONS: { value: UserRoleType; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'content_author', label: 'Content Author' },
  { value: 'admin', label: 'Admin' },
];

const EditStaffModal: React.FC<EditStaffModalProps> = ({ user, currentUserUid, onClose, onSaved }) => {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [department, setDepartment] = useState(user.department || '');
  const [jobTitle, setJobTitle] = useState(user.jobTitle || '');
  const [licenseNumber, setLicenseNumber] = useState(user.licenseNumber || '');
  const [licenseExpiry, setLicenseExpiry] = useState(user.licenseExpiry || '');
  const [role, setRole] = useState<UserRoleType>(user.role);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived: which fields differ from the original user record.
  const profileDirty =
    displayName !== (user.displayName || '') ||
    department !== (user.department || '') ||
    jobTitle !== (user.jobTitle || '') ||
    licenseNumber !== (user.licenseNumber || '') ||
    licenseExpiry !== (user.licenseExpiry || '');
  const roleDirty = role !== user.role;
  const isDirty = profileDirty || roleDirty;
  const trimmedName = displayName.trim();
  const nameValid = trimmedName.length >= 2;
  const isSelf = user.uid === currentUserUid;

  // Live license status from the in-form expiry value.
  const licenseStatus = (() => {
    if (!licenseExpiry) return null;
    const expiry = new Date(licenseExpiry);
    if (Number.isNaN(expiry.getTime())) return null;
    const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Expired', tone: 'bg-red-100 text-red-700', days };
    if (days <= 30) return { label: 'Expiring Soon', tone: 'bg-amber-100 text-amber-700', days };
    return { label: 'Valid', tone: 'bg-green-100 text-green-700', days };
  })();

  const clearLicense = () => {
    setLicenseNumber('');
    setLicenseExpiry('');
  };

  const handleSave = async () => {
    if (!currentUser || isSaving || !isDirty || !nameValid) return;
    setError(null);
    setIsSaving(true);

    const actor = { uid: currentUser.uid, displayName: currentUser.displayName };
    const changes: string[] = [];

    try {
      // 1) Profile fields → direct Firestore write.
      if (profileDirty) {
        const profileUpdates: StaffProfileUpdate = {};
        if (trimmedName !== (user.displayName || '')) profileUpdates.displayName = trimmedName;
        if (department !== (user.department || '')) profileUpdates.department = department.trim() || undefined;
        if (jobTitle !== (user.jobTitle || '')) profileUpdates.jobTitle = jobTitle.trim() || undefined;
        if (licenseNumber !== (user.licenseNumber || '')) {
          profileUpdates.licenseNumber = licenseNumber.trim() ? licenseNumber.trim() : null;
        }
        if (licenseExpiry !== (user.licenseExpiry || '')) {
          profileUpdates.licenseExpiry = licenseExpiry ? licenseExpiry : null;
        }
        await updateStaffProfile(user.uid, profileUpdates, actor);
        changes.push('profile updated');
      }

      // 2) Role change → Cloud Function (separate op; partial success allowed).
      if (roleDirty) {
        await changeStaffRole(user.uid, role);
        changes.push(`role changed to ${role}`);
      }

      addToast({
        type: 'success',
        title: `${trimmedName || user.displayName} updated`,
        message:
          changes.join(', ') +
          (roleDirty
            ? '. User must sign out and back in for role change to take effect.'
            : '.'),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update staff member.';
      setError(msg);
      addToast({ type: 'error', title: 'Update failed', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary-600" />
              Edit Staff Member
            </h3>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Identity */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" />
              Identity
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="es-name">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="es-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
                {!nameValid && trimmedName.length > 0 && (
                  <p className="text-[11px] text-red-600 mt-1">Display name must be at least 2 characters.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="es-dept">Department</label>
                  <input
                    id="es-dept"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="es-title">Job Title</label>
                  <input
                    id="es-title"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: System Role */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              System Role
            </h4>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="es-role">Role</label>
              <select
                id="es-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRoleType)}
                disabled={isSaving || isSelf}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 bg-white"
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {isSelf && (
                <p className="text-[11px] text-gray-500 mt-1">
                  You cannot change your own role from this UI.
                </p>
              )}
              {roleDirty && !isSelf && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Role changes require the user to sign out and back in. JWT custom claims
                    are baked into the auth token at sign-in time and update on next login.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Section 3: License Information */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <IdCard className="h-3.5 w-3.5" />
                License Information
              </h4>
              {(licenseNumber || licenseExpiry) && (
                <button
                  type="button"
                  onClick={clearLicense}
                  disabled={isSaving}
                  className="text-[11px] font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50"
                >
                  Clear License
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="es-lic-num">License Number</label>
                <input
                  id="es-lic-num"
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  placeholder="e.g., RN123456"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="es-lic-exp">License Expiry</label>
                <input
                  id="es-lic-exp"
                  type="date"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-500">Status:</span>
              {licenseStatus ? (
                <>
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', licenseStatus.tone)}>
                    {licenseStatus.label}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {licenseStatus.days >= 0
                      ? `${licenseStatus.days} day${licenseStatus.days === 1 ? '' : 's'} remaining`
                      : `${Math.abs(licenseStatus.days)} day${Math.abs(licenseStatus.days) === 1 ? '' : 's'} ago`}
                  </span>
                </>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-500">
                  N/A
                </span>
              )}
            </div>
          </section>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isSaving || !isDirty || !nameValid}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

interface UserManagementProps {
  onNavigate?: (path: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onNavigate }) => {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { courses } = useCourses();
  const [users, setUsers] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollModalUserId, setEnrollModalUserId] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  // Active / inactive tab + deactivation/reactivation/edit modal state (Guide 15).
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');
  const [reactivatingUser, setReactivatingUser] = useState<User | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Row action menu — the three-dot button on each row opens this floating
  // menu via a portal so it isn't clipped by the table card's overflow-hidden.
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const toggleRowMenu = (uid: string, anchor: HTMLElement) => {
    if (openMenuUid === uid) {
      setOpenMenuUid(null);
      setMenuPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuUid(uid);
  };

  const closeRowMenu = () => {
    setOpenMenuUid(null);
    setMenuPosition(null);
  };

  useEffect(() => {
    if (!openMenuUid) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && !target.closest('[data-row-menu]')) {
        closeRowMenu();
      }
    };
    const onScrollOrResize = () => closeRowMenu();
    window.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [openMenuUid]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all users from Firestore
      const usersSnap = await getDocs(
        query(collection(db, 'users'), orderBy('displayName'))
      );
      const fetchedUsers: User[] = usersSnap.docs.map(doc => ({
        uid: doc.data().uid || doc.id,
        displayName: doc.data().displayName || 'Unknown',
        email: doc.data().email || '',
        role: doc.data().role || 'staff',
        department: doc.data().department,
        jobTitle: doc.data().jobTitle,
        licenseNumber: doc.data().licenseNumber,
        licenseExpiry: doc.data().licenseExpiry,
        status: doc.data().status || 'active',
        deactivatedAt: doc.data().deactivatedAt?.toDate?.()?.toISOString(),
        deactivatedBy: doc.data().deactivatedBy,
      }));
      setUsers(fetchedUsers);

      // Fetch all enrollments
      const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));
      const fetchedEnrollments: Enrollment[] = enrollmentsSnap.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        courseId: doc.data().courseId,
        progress: doc.data().progress ?? 0,
        status: doc.data().status ?? 'not_started',
        enrolledAt: doc.data().enrolledAt?.toDate?.()?.toISOString() || '',
        lastAccessedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || '',
      }));
      setEnrollments(fetchedEnrollments);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load users';
      setError(msg);
      console.error('UserManagement fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEnroll = async (courseId: string, userId: string) => {
    if (!currentUser || isEnrolling) return;
    setIsEnrolling(true);

    try {
      await createEnrollment(userId, courseId, currentUser.uid, currentUser.displayName);
      const targetUser = users.find(u => u.uid === userId);
      const course = courses.find(c => c.id === courseId);
      addToast({ type: 'success', title: `${targetUser?.displayName || 'User'} enrolled`, message: `Enrolled in ${course?.title || 'course'}` });
      setEnrollModalUserId(null);
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      addToast({ type: 'error', title: 'Failed to enroll user', message: msg });
      console.error('Failed to enroll user:', err);
    } finally {
      setIsEnrolling(false);
    }
  };

  const filteredUsers = users.filter(u =>
    searchFilter === '' ||
    u.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    u.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Tab split — undefined `status` is treated as 'active' for backward compat.
  const activeUsers = filteredUsers.filter(u => u.status !== 'deactivated');
  const inactiveUsers = filteredUsers.filter(u => u.status === 'deactivated');
  const displayedUsers = activeTab === 'active' ? activeUsers : inactiveUsers;

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
      await fetchData();
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
      setActiveTab('active');
      await fetchData();
    } catch (err: any) {
      const msg = err?.message || 'Failed to reactivate account.';
      addToast({ type: 'error', title: 'Reactivation failed', message: msg });
    } finally {
      setIsReactivating(false);
    }
  };

  const renderEnrollModal = (userId: string) => {
    const targetUser = users.find(u => u.uid === userId);
    const userEnrollmentIds = enrollments.filter(e => e.userId === userId).map(e => e.courseId);
    const availableCourses = courses.filter(c => !userEnrollmentIds.includes(c.id));

    return (
      <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 animate-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Enroll Staff Member</h3>
          <p className="text-sm text-gray-500 mb-6">Select a course to assign to {targetUser?.displayName}.</p>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {availableCourses.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">All available courses are already assigned.</p>
            ) : (
                availableCourses.map(course => (
                    <button
                        key={course.id}
                        onClick={() => handleEnroll(course.id, userId)}
                        disabled={isEnrolling}
                        className="w-full p-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-left flex items-center gap-3 disabled:opacity-50"
                    >
                        <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                            <Book className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">{course.title}</p>
                            <p className="text-[10px] text-gray-500">{course.category} - {course.ceCredits} CE Credits</p>
                        </div>
                    </button>
                ))
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <Button variant="outline" className="flex-1" onClick={() => setEnrollModalUserId(null)} disabled={isEnrolling}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {enrollModalUserId && renderEnrollModal(enrollModalUserId)}
      {showCreateAccount && (
        <CreateAccountModal
          onClose={() => setShowCreateAccount(false)}
          onCreated={fetchData}
        />
      )}

      {editingUser && currentUser && (
        <EditStaffModal
          user={editingUser}
          currentUserUid={currentUser.uid}
          onClose={() => setEditingUser(null)}
          onSaved={fetchData}
        />
      )}

      {/* Row action dropdown — portaled so it escapes the table's overflow:hidden. */}
      {openMenuUid && menuPosition && (() => {
        const menuUser = users.find(u => u.uid === openMenuUid);
        if (!menuUser || menuUser.status === 'deactivated') return null;
        const canDeactivate = menuUser.uid !== currentUser?.uid;
        return createPortal(
          <div
            data-row-menu
            role="menu"
            style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }}
            className="z-50 min-w-[160px] bg-white border border-gray-200 rounded-md shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={() => { setEditingUser(menuUser); closeRowMenu(); }}
            >
              <Pencil className="h-3.5 w-3.5 text-gray-500" />
              Edit
            </button>
            <button
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={() => { setEnrollModalUserId(menuUser.uid); closeRowMenu(); }}
            >
              <PlusCircle className="h-3.5 w-3.5 text-gray-500" />
              Enroll
            </button>
            {canDeactivate && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => { setDeactivatingUser(menuUser); closeRowMenu(); }}
                >
                  <UserX className="h-3.5 w-3.5" />
                  Deactivate
                </button>
              </>
            )}
          </div>,
          document.body
        );
      })()}

      {deactivatingUser && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-in zoom-in duration-200">
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
                  disabled={isDeactivating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  placeholder={deactivatingUser.displayName}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDeactivatingUser(null);
                  setDeactivateConfirmText('');
                }}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
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
      )}

      {reactivatingUser && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-in zoom-in duration-200">
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
              Their previous enrollments, grades, and certificates remain intact,
              and they can log in with their existing credentials.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setReactivatingUser(null)}
                disabled={isReactivating}
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
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-600" />
            Staff Compliance Directory
          </h1>
          <p className="text-gray-500 mt-1">Manage user roles and track organizational training requirements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowCreateAccount(true)} className="gap-2">
            <KeyRound className="h-4 w-4" />
            Create Account
          </Button>
          <Button onClick={() => onNavigate?.('/invitations')} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, email or department..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-6 px-6 border-b border-gray-200 bg-white">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'py-3 text-sm font-semibold border-b-2 transition-colors flex items-center',
              activeTab === 'active'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
              'py-3 text-sm font-semibold border-b-2 transition-colors flex items-center',
              activeTab === 'inactive'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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

        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-700">Staff Member</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Role</th>
              <th className="px-6 py-4 font-semibold text-gray-700">License</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Compliance</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Enrollments</th>
              <th className="px-6 py-4 font-semibold text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Loading staff directory...
                </td>
              </tr>
            ) : displayedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                  {searchFilter
                    ? 'No staff members match your search.'
                    : activeTab === 'active'
                      ? 'No active staff in the system.'
                      : 'No deactivated staff.'}
                </td>
              </tr>
            ) : (
              displayedUsers.map(user => {
                const userEnrollments = enrollments.filter(e => e.userId === user.uid);
                const compliance = user.role === 'admin' ? 100 : userEnrollments.length > 0
                  ? (userEnrollments.filter(e => e.status === 'completed').length / userEnrollments.length) * 100
                  : 0;

                return (
                  <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center font-bold',
                          user.status === 'deactivated' ? 'bg-gray-100 text-gray-400' : 'bg-primary-100 text-primary-700'
                        )}>
                          {user.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center">
                            {user.displayName}
                            {user.status === 'deactivated' && (
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          {user.jobTitle && (
                            <div className="text-xs text-gray-400 mt-0.5">{user.jobTitle} &middot; {user.department || 'No dept'}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                        user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        if (!user.licenseExpiry) {
                          return <span className="text-xs text-gray-400">N/A</span>;
                        }
                        const expiry = new Date(user.licenseExpiry);
                        const now = new Date();
                        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const isExpired = daysLeft < 0;
                        const isExpiringSoon = !isExpired && daysLeft <= 30;

                        return (
                          <div>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              isExpired ? "bg-red-100 text-red-700" :
                              isExpiringSoon ? "bg-amber-100 text-amber-700" :
                              "bg-green-100 text-green-700"
                            )}>
                              {isExpired ? 'Expired' : isExpiringSoon ? `${daysLeft}d left` : 'Valid'}
                            </span>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              compliance >= 90 ? "bg-green-500" : compliance >= 70 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${compliance}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{Math.round(compliance)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="h-4 w-4 text-gray-300" />
                        {userEnrollments.length} Active
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {user.status === 'deactivated' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setReactivatingUser(user)}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Reactivate
                          </Button>
                        ) : (
                          <button
                            data-row-menu
                            className="p-1 hover:bg-gray-100 rounded"
                            aria-label="Open actions menu"
                            aria-haspopup="menu"
                            aria-expanded={openMenuUid === user.uid}
                            onClick={(e) => toggleRowMenu(user.uid, e.currentTarget)}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
