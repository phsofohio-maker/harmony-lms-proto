import React, { useState } from 'react';
import { User, UserRoleType } from './types';
import { MOCK_USERS } from './services/mockData';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ModuleBuilder } from './pages/ModuleBuilder';
import { AuditLogs } from './pages/AuditLogs';
import { CourseCatalog } from './pages/CourseCatalog';
import { CoursePlayer } from './pages/CoursePlayer';
import { auditService } from './services/auditService';
import { Lock } from 'lucide-react';
import { Button } from './components/ui/Button';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPath, setCurrentPath] = useState('/');

  const handleLogin = (role: UserRoleType) => {
    const mockUser = MOCK_USERS.find(u => u.role === role);
    if (mockUser) {
      setUser(mockUser);
      auditService.logAction(mockUser.uid, mockUser.displayName, 'USER_LOGIN', 'system', 'User logged in');
    }
  };

  const renderContent = () => {
    if (!user) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-50 p-8 border-b border-slate-100 text-center">
                    <div className="h-16 w-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="h-8 w-8 text-brand-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Harmony Health LMS</h1>
                    <p className="text-slate-500 mt-2 text-sm">Secure Clinical Training Platform</p>
                </div>
                <div className="p-8 space-y-4">
                    <p className="text-center text-sm font-medium text-slate-600 mb-4">Select a role to simulate:</p>
                    <Button onClick={() => handleLogin('admin')} className="w-full h-12 text-lg">
                        Login as Administrator
                    </Button>
                    <Button onClick={() => handleLogin('staff')} variant="outline" className="w-full h-12 text-lg">
                        Login as Staff Member
                    </Button>
                </div>
                <div className="bg-slate-50 p-4 text-center text-xs text-slate-400">
                    Proprietary Software for Parrish Health Systems
                </div>
            </div>
        </div>
      );
    }

    if (currentPath === '/player') {
       return <CoursePlayer userUid={user.uid} onBack={() => setCurrentPath('/courses')} />;
    }

    const Router = () => {
      switch (currentPath) {
        case '/':
          return <Dashboard user={user} onNavigate={setCurrentPath} />;
        case '/builder':
          return <ModuleBuilder userUid={user.uid} onBack={() => setCurrentPath('/')} />;
        case '/audit':
            return <AuditLogs />;
        case '/courses':
            return <CourseCatalog onNavigate={setCurrentPath} />;
        default:
          return <Dashboard user={user} onNavigate={setCurrentPath} />;
      }
    };

    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar 
            user={user} 
            currentPath={currentPath} 
            onNavigate={setCurrentPath} 
            onLogout={() => {
                setUser(null);
                setCurrentPath('/');
            }} 
        />
        <main className="flex-1 ml-64">
          <Router />
        </main>
      </div>
    );
  };

  return renderContent();
};

export default App;