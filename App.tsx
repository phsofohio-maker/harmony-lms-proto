/**
 * Application Root
 * 
 * Wraps the app in AuthProvider and handles routing based on auth state.
 * 
 * @module App
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ModuleBuilder } from './pages/ModuleBuilder';
import { AuditLogs } from './pages/AuditLogs';
import { CourseCatalog } from './pages/CourseCatalog';
import { CoursePlayer } from './pages/CoursePlayer';
import { Loader2 } from 'lucide-react';
//import { EnrollmentTestPanel } from './scripts/enrollmentServiceVerification';
//import { ProgressTestPanel } from './scripts/progressServiceVerification';
import { GradeTestPanel } from './scripts/gradeServiceVerification';

// Loading spinner for initial auth check
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-12 w-12 text-brand-600 animate-spin mx-auto" />
      <p className="mt-4 text-slate-500 font-medium">Loading...</p>
    </div>
  </div>
);

// Main app content (requires auth)
const AppContent: React.FC = () => {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [currentPath, setCurrentPath] = useState('/');
  
  // Route state for module builder
  const [builderContext, setBuilderContext] = useState<{
    courseId?: string;
    moduleId?: string;
  }>({});

  // Show loading during initial auth check
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show login if not authenticated
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // Handle navigation with context
  const handleNavigate = (path: string, context?: Record<string, any>) => {
    setCurrentPath(path);
    if (context) {
      setBuilderContext(context);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    setCurrentPath('/');
  };

  // Route to player
  if (currentPath === '/player') {
    return (
      <CoursePlayer 
        userUid={user.uid} 
        onBack={() => setCurrentPath('/courses')} 
      />
    );
  }

  // Router component
  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <Dashboard user={user} onNavigate={handleNavigate} />;
      case '/builder':
        return (
          <ModuleBuilder
            courseId={builderContext.courseId}
            moduleId={builderContext.moduleId}
            userUid={user.uid}
            onBack={() => setCurrentPath('/')}
          />
        );
      case '/audit':
        return <GradeTestPanel />;  
      //return <AuditLogs />;
      case '/courses':
        return <CourseCatalog onNavigate={handleNavigate} />;
      default:
        return <Dashboard user={user} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        user={user}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
      <main className="flex-1 ml-64">
        {renderPage()}
      </main>
    </div>
  );
};

// Root component with providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;