/**
 * Authentication Context
 * 
 * Provides auth state and operations to the entire app.
 * Wrap your App component with <AuthProvider> and consume via useAuth().
 * 
 * @module contexts/AuthContext
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, UserRoleType } from '../types';
import {
  loginWithEmail,
  logout as authLogout,
  subscribeToAuthState,
  getUserProfile,
  AuthServiceError,
} from '../services/authService';

// Auth state shape
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// Context value shape
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  hasRole: (roles: UserRoleType | UserRoleType[]) => boolean;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isLoading: true, // Start true to prevent flash of login screen
  isAuthenticated: false,
  error: null,
};

// Create context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // Subscribe to Firebase auth state on mount
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // User is signed in—fetch their profile
          const profile = await getUserProfile(firebaseUser.uid);
          
          if (profile) {
            setState({
              user: profile,
              isLoading: false,
              isAuthenticated: true,
              error: null,
            });
          } else {
            // Auth exists but no profile—unusual state
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
              error: 'User profile not found. Contact administrator.',
            });
          }
        } catch (err) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: 'Failed to load user profile.',
          });
        }
      } else {
        // No user signed in
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Login handler
  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const user = await loginWithEmail(email, password);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (err) {
      const message = err instanceof AuthServiceError 
        ? err.message 
        : 'An unexpected error occurred.';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw err; // Re-throw so UI can handle if needed
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authLogout();
      // State will be updated by onAuthStateChanged listener
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to sign out.',
      }));
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Role check helper
  const hasRole = useCallback((roles: UserRoleType | UserRoleType[]) => {
    if (!state.user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(state.user.role);
  }, [state.user]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    login,
    logout,
    clearError,
    hasRole,
  }), [state, login, logout, clearError, hasRole]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for consuming auth context
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Higher-order component for role-based access (optional utility)
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: UserRoleType[]
): React.FC<P> => {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, hasRole, isLoading } = useAuth();
    
    if (isLoading) {
      return null; // Or loading spinner
    }
    
    if (!isAuthenticated) {
      return null; // Or redirect to login
    }
    
    if (allowedRoles && !hasRole(allowedRoles)) {
      return null; // Or "Access Denied" component
    }
    
    return <Component {...props} />;
  };
};