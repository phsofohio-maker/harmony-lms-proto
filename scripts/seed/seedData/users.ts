/**
 * Seed User Definitions
 *
 * Staff accounts for Parrish Healthcare's Harmony LMS.
 * Used by seedUsers.ts to create Firebase Auth + Firestore profiles.
 */

export interface SeedUser {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'instructor' | 'staff';
  department: string;
  jobTitle: string;
}

export const SEED_USERS: SeedUser[] = [
  // ── Admins (2) ──────────────────────────────────
  {
    email: 'sarah.chen@parrish.health',
    password: 'ParrishAdmin2026!',
    displayName: 'Sarah Chen',
    role: 'admin',
    department: 'Information Technology',
    jobTitle: 'IT Administrator',
  },
  {
    email: 'marcus.wright@parrish.health',
    password: 'ParrishAdmin2026!',
    displayName: 'Marcus Wright',
    role: 'admin',
    department: 'Clinical Education',
    jobTitle: 'Education Director',
  },

  // ── Instructors (3) ─────────────────────────────
  {
    email: 'dr.patricia.gomez@parrish.health',
    password: 'ParrishInstr2026!',
    displayName: 'Dr. Patricia Gomez',
    role: 'instructor',
    department: 'Hospice Care',
    jobTitle: 'Medical Director',
  },
  {
    email: 'james.okonkwo@parrish.health',
    password: 'ParrishInstr2026!',
    displayName: 'James Okonkwo',
    role: 'instructor',
    department: 'Clinical Education',
    jobTitle: 'Clinical Educator',
  },
  {
    email: 'linda.tran@parrish.health',
    password: 'ParrishInstr2026!',
    displayName: 'Linda Tran',
    role: 'instructor',
    department: 'Compliance',
    jobTitle: 'Compliance Officer',
  },

  // ── Staff (7) ───────────────────────────────────
  {
    email: 'maria.santos@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'Maria Santos, RN',
    role: 'staff',
    department: 'Hospice Care',
    jobTitle: 'RN',
  },
  {
    email: 'david.kim@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'David Kim, CNA',
    role: 'staff',
    department: 'Hospice Care',
    jobTitle: 'CNA',
  },
  {
    email: 'ashley.brooks@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'Ashley Brooks, LPN',
    role: 'staff',
    department: 'Hospice Care',
    jobTitle: 'LPN',
  },
  {
    email: 'robert.jackson@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'Robert Jackson, RN',
    role: 'staff',
    department: 'Home Health',
    jobTitle: 'RN',
  },
  {
    email: 'jennifer.patel@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'Jennifer Patel, MSW',
    role: 'staff',
    department: 'Social Services',
    jobTitle: 'MSW',
  },
  {
    email: 'thomas.nguyen@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'Thomas Nguyen, RN',
    role: 'staff',
    department: 'Hospice Care',
    jobTitle: 'RN',
  },
  {
    email: 'rachel.martinez@parrish.health',
    password: 'ParrishStaff2026!',
    displayName: 'Rachel Martinez, CHPNA',
    role: 'staff',
    department: 'Hospice Care',
    jobTitle: 'CHPNA',
  },
];
