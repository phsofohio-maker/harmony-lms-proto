import React from 'react';
import { User, UserRoleType } from '../../functions/src/types';
import { 
  BookOpen, 
  LayoutDashboard, 
  ShieldCheck, 
  Users, 
  LogOut, 
  FileEdit,
  Stethoscope,
  TestTubes
} from 'lucide-react';
import { cn } from '../../utils';

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
          ? "bg-brand-50 text-brand-700" 
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );

  return (
    <div className="w-64 flex flex-col border-r border-slate-200 bg-white h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-brand-700 font-bold text-xl">
          <Stethoscope className="h-7 w-7" />
          <span>Harmony</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Clinical LMS</p>
      </div>

      <div className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
        <div className="mb-4 px-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Platform</p>
            <NavItem path="/" icon={LayoutDashboard} label="Dashboard" />
            <NavItem path="/courses" icon={BookOpen} label="Course Catalog" />
        </div>

        {user.role === 'admin' && (
          <div className="mb-4 px-3">
             <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin</p>
             <NavItem path="/builder" icon={FileEdit} label="Content Builder" />
             <NavItem path="/users" icon={Users} label="User Management" />
             <NavItem path="/audit" icon={ShieldCheck} label="Audit Logs" />
             <NavItem path="/verify-questions" icon={TestTubes} label="Verification Panel" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
            {user.displayName.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user.role}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="flex w-full items-center gap-2 text-slate-500 hover:text-critical-600 text-sm px-1 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};