/**
 * License Check Hook
 *
 * Computes the license status for the current user by comparing
 * their licenseExpiry to today's date. Used by LicenseGate to
 * block access to clinical courses when a license has expired.
 *
 * @module hooks/useLicenseCheck
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LicenseStatus } from '../functions/src/types';

const EXPIRING_SOON_DAYS = 30;

export interface LicenseCheckResult {
  licenseStatus: LicenseStatus;
  isLicenseValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  expiryDate: Date | null;
  licenseNumber: string | null;
}

export const useLicenseCheck = (): LicenseCheckResult => {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user?.licenseExpiry) {
      return {
        licenseStatus: 'not_set' as LicenseStatus,
        isLicenseValid: true, // Non-clinical staff aren't gated
        isExpired: false,
        isExpiringSoon: false,
        daysUntilExpiry: null,
        expiryDate: null,
        licenseNumber: user?.licenseNumber || null,
      };
    }

    const now = new Date();
    const expiry = new Date(user.licenseExpiry);
    const diffMs = expiry.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let licenseStatus: LicenseStatus;
    if (daysUntilExpiry < 0) {
      licenseStatus = 'expired';
    } else if (daysUntilExpiry <= EXPIRING_SOON_DAYS) {
      licenseStatus = 'expiring_soon';
    } else {
      licenseStatus = 'valid';
    }

    return {
      licenseStatus,
      isLicenseValid: licenseStatus !== 'expired',
      isExpired: licenseStatus === 'expired',
      isExpiringSoon: licenseStatus === 'expiring_soon',
      daysUntilExpiry,
      expiryDate: expiry,
      licenseNumber: user.licenseNumber || null,
    };
  }, [user?.licenseExpiry, user?.licenseNumber]);
};
