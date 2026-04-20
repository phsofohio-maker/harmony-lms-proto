import React, { useState } from 'react';
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
  UsersRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '../../utils';
import { useAppSound } from '../../hooks/useAppSound';

interface SidebarProps {
  user: User | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, currentPath, onNavigate, onLogout }) => {
  const { isSoundEnabled, toggleSound } = useAppSound();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  if (!user) return null;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => onNavigate(path)}
        className={cn(
          "flex w-full items-center gap-3 py-[7px] px-5 text-[13px] transition-all duration-150 border-l-3",
          isActive
            ? "bg-primary-50 font-semibold text-primary-700 border-primary-500"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium border-transparent"
        )}
      >
        <Icon
          className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary-500" : "text-gray-400")}
          strokeWidth={1.75}
        />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="w-[260px] flex flex-col bg-white border-r border-gray-200 h-screen fixed left-0 top-0 z-50">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200 mb-1">
        <div className="flex items-center gap-3">
          <img
            src="/images/Halo_O_SymbolEPS_.svg"
            alt="HALO"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <img
            src="/images/HALO_LMSEPS_.svg"
            alt="Parrish HALO LMS"
            className="w-[140px] h-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
        <div className="mb-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] px-5 pt-4 pb-2">Platform</p>
          <NavItem path="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem path="/courses" icon={BookOpen} label="Course Catalog" />
          <NavItem path="/my-grades" icon={GraduationCap} label="My Grades" />
        </div>

        {(user.role === 'admin' || user.role === 'instructor') && (
          <div className="mb-1">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] px-5 pt-4 pb-2">Management</p>
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

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-navy-900 flex items-center justify-center text-white font-bold text-sm">
            {user.displayName.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[13px] font-semibold text-gray-900 truncate">{user.displayName}</p>
            <p className="text-[11px] text-gray-400 truncate capitalize font-semibold">{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => setSoundOn(toggleSound())}
          className="flex w-full items-center gap-2 text-gray-400 hover:text-gray-600 text-xs px-1 mb-3 transition-colors"
        >
          {soundOn ? <Volume2 className="h-4 w-4" strokeWidth={1.75} /> : <VolumeX className="h-4 w-4" strokeWidth={1.75} />}
          <span>{soundOn ? 'Sound on' : 'Sound off'}</span>
        </button>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 text-gray-400 hover:text-gray-600 text-sm px-1 transition-colors"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </div>
  );
};
