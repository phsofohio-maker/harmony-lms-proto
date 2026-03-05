import React from 'react';
import { User, UserRoleType } from '../../functions/src/types';
import {
  BookOpen,
  LayoutDashboard,
  ShieldCheck,
  Users,
  LogOut,
  Layers,
  GraduationCap,
  ClipboardCheck,
  UserPlus,
  AlertTriangle,
  UsersRound
} from 'lucide-react';
import { cn } from '../../utils';
import { AppLogo } from '../ui/AppLogo';

interface SidebarProps {
  user: User | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, currentPath, onNavigate, onLogout }) => {
  if (!user) return null;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => (
    <button
      onClick={() => onNavigate(path)}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
        currentPath === path
          ? "bg-[var(--color-brand-primary)] text-[var(--color-text-on-dark)]"
          : "text-[var(--color-text-on-dark)] opacity-70 hover:bg-[var(--color-brand-mid)] hover:opacity-100"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );

  return (
    <div className="w-64 flex flex-col border-r border-[var(--color-brand-border)] bg-[var(--color-surface-deep)] h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-[var(--color-brand-border)]">
        <AppLogo variant="dark" size="md" />
      </div>

      <div className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
        <div className="mb-4 px-3">
          <p className="font-label tracking-widest uppercase text-xs text-[var(--color-text-caption)] mb-2">Platform</p>
          <NavItem path="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem path="/courses" icon={BookOpen} label="Course Catalog" />
          <NavItem path="/my-grades" icon={GraduationCap} label="My Grades" />
        </div>

        {(user.role === 'admin' || user.role === 'instructor') && (
          <div className="mb-4 px-3">
            <p className="font-label tracking-widest uppercase text-xs text-[var(--color-text-caption)] mb-2">Management</p>
            <NavItem path="/curriculum" icon={Layers} label="Course Manager" />
            <NavItem path="/grade-management" icon={ClipboardCheck} label="Grade Center" />
            <NavItem path="/remediation" icon={AlertTriangle} label="Remediation" />
            <NavItem path="/cohorts" icon={UsersRound} label="Cohorts" />
            <NavItem path="/invitations" icon={UserPlus} label="Invite Staff" />
            <NavItem path="/users" icon={Users} label="Staff Directory" />
            <NavItem path="/audit" icon={ShieldCheck} label="Audit Trail" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--color-brand-border)] bg-[var(--color-surface-deep)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-[var(--color-brand-mid)] flex items-center justify-center text-[var(--color-text-on-dark)] font-bold">
            {user.displayName.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-[var(--color-text-on-dark)] truncate">{user.displayName}</p>
            <p className="text-xs text-[var(--color-text-caption)] truncate capitalize font-semibold">{user.role}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 text-[var(--color-text-on-dark)] opacity-60 hover:opacity-100 hover:text-[var(--color-status-danger)] text-sm px-1 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
