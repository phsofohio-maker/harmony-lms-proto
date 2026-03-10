/**
 * Invitations Page — Deployment Sprint Phase 2
 *
 * Fully wired to Firestore. No mock data.
 * Creates real invitation records, dispatches email via the mail
 * collection (Firebase Extension), and manages invitation lifecycle.
 *
 * @module pages/Invitations
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Mail,
  Shield,
  Send,
  RefreshCw,
  X,
  Upload,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { UserRoleType, Invitation } from '../functions/src/types';
import { formatDate, cn } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import {
  getInvitations,
  createInvitation,
  resendInvitation,
  cancelInvitation,
} from '../services/invitationService';

export const Invitations: React.FC = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRoleType>('staff');
  const [department, setDepartment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sendError, setSendError] = useState('');

  // Invitation list state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await getInvitations();
      setInvitations(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load invitations';
      setLoadError(msg);
      console.error('Invitations fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !user) return;

    setIsSending(true);
    setSendError('');

    try {
      const newInvite = await createInvitation(
        email,
        role,
        department,
        user.uid,
        user.displayName || 'Admin'
      );
      setInvitations(prev => [newInvite, ...prev]);
      setEmail('');
      setDepartment('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setSendError(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (id: string) => {
    if (!user) return;
    setResendingId(id);
    try {
      await resendInvitation(id, user.uid, user.displayName || 'Admin');
      // Refresh the list to get updated sentAt
      await fetchInvitations();
    } catch (err) {
      console.error('Resend error:', err);
    } finally {
      setResendingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!user) return;
    setCancellingId(id);
    try {
      await cancelInvitation(id, user.uid, user.displayName || 'Admin');
      setInvitations(prev =>
        prev.map(inv => inv.id === id ? { ...inv, status: 'cancelled' as const } : inv)
      );
    } catch (err) {
      console.error('Cancel error:', err);
    } finally {
      setCancellingId(null);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getStatusColor = (status: Invitation['status']) => {
    switch (status) {
      case 'pending': return 'bg-primary-50 text-primary-600 border-primary-100';
      case 'accepted': return 'bg-green-50 text-green-600 border-green-100';
      case 'expired': return 'bg-red-50 text-red-600 border-red-100';
      case 'cancelled': return 'bg-gray-50 text-gray-500 border-gray-200';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const getIconColor = (status: Invitation['status']) => {
    switch (status) {
      case 'accepted': return 'bg-green-50 text-green-500';
      case 'expired': return 'bg-red-50 text-red-500';
      case 'cancelled': return 'bg-gray-50 text-gray-400';
      default: return 'bg-primary-50 text-primary-600';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary-600" />
          Staff Onboarding
        </h1>
        <p className="text-gray-500 mt-1">Invite your clinical team members to the Harmony training portal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invite Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden">
            {showSuccess && (
              <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center text-white z-10 animate-in fade-in duration-300">
                <CheckCircle2 className="h-12 w-12 mb-2" />
                <p className="font-bold">Invitation Sent!</p>
              </div>
            )}

            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-primary-500" />
              Send New Invite
            </h2>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-300" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. nurse@harmony.health"
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assign Role</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRoleType)}
                >
                  <option value="staff">Staff Member</option>
                  <option value="instructor">Instructor / Preceptor</option>
                  <option value="content_author">Content Author</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Department (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Hospice Unit 4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              {sendError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{sendError}</p>
                </div>
              )}

              <Button className="w-full h-11" type="submit" isLoading={isSending}>
                Dispatch Invitation
              </Button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Upload className="h-5 w-5 text-primary-700" />
              </div>
              <h3 className="font-bold text-gray-900">Bulk Onboarding</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Uploading a CSV of clinical staff allows for mass enrollment and automated department assignment.
            </p>
            <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 border-dashed">
              Upload CSV File
            </Button>
          </div>
        </div>

        {/* Invitations List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Invitations</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400">{invitations.length} Total</span>
                <button
                  onClick={fetchInvitations}
                  disabled={isLoading}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-all"
                  title="Refresh"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                </button>
              </div>
            </div>

            {loadError && (
              <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{loadError}</p>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {isLoading ? (
                <div className="p-12 text-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Loading invitations...
                </div>
              ) : invitations.length === 0 ? (
                <div className="p-12 text-center text-gray-400 italic">
                  No invitations yet. Send one to get started.
                </div>
              ) : (
                invitations.map(invite => (
                  <div key={invite.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center',
                        getIconColor(invite.status)
                      )}>
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm">{invite.email}</p>
                          <span className={cn(
                            'text-[8px] font-black uppercase px-1.5 py-0.5 rounded border',
                            getStatusColor(invite.status)
                          )}>
                            {invite.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-primary-700 capitalize">{invite.role}</span>
                          {invite.department && <span>• {invite.department}</span>}
                          <span>• Sent {formatDate(invite.sentAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {invite.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResend(invite.id)}
                            disabled={resendingId === invite.id}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-all disabled:opacity-50"
                            title="Resend Invitation"
                          >
                            {resendingId === invite.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <RefreshCw className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleCancel(invite.id)}
                            disabled={cancellingId === invite.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all disabled:opacity-50"
                            title="Cancel Invite"
                          >
                            {cancellingId === invite.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <X className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                      {invite.status === 'expired' && (
                        <button
                          onClick={() => handleResend(invite.id)}
                          disabled={resendingId === invite.id}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-all disabled:opacity-50"
                          title="Resend Invitation"
                        >
                          {resendingId === invite.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 bg-white border border-gray-200 border-l-4 border-l-info-600 rounded-lg p-4 flex gap-4 shadow-xs">
            <Shield className="h-6 w-6 text-gray-500 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-gray-900">Compliance Warning</h4>
              <p className="text-xs text-gray-600 leading-relaxed mt-1">
                Invitations expire after 72 hours. To maintain organizational security, ensure staff complete their profile setup immediately upon receipt of the clinical onboarding email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
