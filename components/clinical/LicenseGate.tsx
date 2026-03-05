/**
 * License Gate Component
 *
 * Blocks access to clinical courses when a user's license has expired.
 * Courses with category "hospice" or "clinical_skills" require a valid license.
 * Shows a warning banner for licenses expiring within 30 days.
 *
 * @module components/clinical/LicenseGate
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Clock } from 'lucide-react';
import { useLicenseCheck } from '../../hooks/useLicenseCheck';
import { CourseCategory, LICENSE_REQUIRED_CATEGORIES } from '../../functions/src/types';

interface LicenseGateProps {
  children: React.ReactNode;
  courseCategory?: CourseCategory | string;
}

export const LicenseGate: React.FC<LicenseGateProps> = ({ children, courseCategory }) => {
  const { licenseStatus, isExpired, isExpiringSoon, daysUntilExpiry, expiryDate } = useLicenseCheck();

  // Only gate courses in clinical categories
  const requiresLicense = courseCategory &&
    LICENSE_REQUIRED_CATEGORIES.includes(courseCategory as CourseCategory);

  if (!requiresLicense) {
    return <>{children}</>;
  }

  // Non-clinical staff (no license set) are not gated
  if (licenseStatus === 'not_set' || licenseStatus === 'valid') {
    return <>{children}</>;
  }

  // Expired — full block
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="bg-white rounded-2xl border-2 border-[var(--color-status-danger)] shadow-xl max-w-lg w-full p-8 text-center">
          <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-10 w-10 text-[var(--color-status-danger)]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">License Expired</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Your clinical license expired on{' '}
            <strong className="text-red-600">
              {expiryDate?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </strong>.
            Access to clinical training content is restricted until your license is renewed.
          </p>
          <div className="bg-[#FFF0F0] border border-[var(--color-status-danger)] rounded-lg p-4 text-sm" style={{ color: 'var(--color-status-danger)' }}>
            <p className="font-semibold mb-1">What to do next:</p>
            <p>Contact your supervisor or the Clinical Education department to update your license information.</p>
          </div>
        </div>
      </div>
    );
  }

  // Expiring soon — warning banner above content
  if (isExpiringSoon) {
    return (
      <>
        <div className="bg-[var(--color-status-warning)] px-6 py-3 flex items-center gap-3">
          <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label text-sm text-white uppercase tracking-[0.06em]">
              License Expiring Soon
            </p>
            <p className="text-xs text-white/80">
              Your clinical license expires in{' '}
              <strong>{daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</strong>
              {expiryDate && (
                <> ({expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</>
              )}. Contact your supervisor to arrange renewal.
            </p>
          </div>
          <Clock className="h-4 w-4 text-white/80 shrink-0" />
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
};
