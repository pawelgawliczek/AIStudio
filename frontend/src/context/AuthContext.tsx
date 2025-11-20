import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService, { User, LoginCredentials, RegisterData } from '../services/auth.service';
import { onSessionExpired } from '../services/api.client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials, redirectPath?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  redirectPath: string | null;
  setRedirectPath: (path: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const authChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize auth state and multi-tab sync
  useEffect(() => {
    console.log('[AuthContext] Initializing...');
    const currentUser = authService.getCurrentUser();
    console.log('[AuthContext] Current user:', currentUser);
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
    console.log('[AuthContext] Loading complete, user:', currentUser ? 'authenticated' : 'not authenticated');

    // Setup multi-tab sync using BroadcastChannel
    try {
      const channel = new BroadcastChannel('auth_channel');
      authChannelRef.current = channel;

      channel.onmessage = (event) => {
        console.log('[AuthContext] Received message from other tab:', event.data);

        if (event.data.type === 'LOGOUT') {
          // User logged out in another tab
          setUser(null);
          navigate('/login');
        } else if (event.data.type === 'TOKEN_UPDATED') {
          // Token was refreshed in another tab - update local state
          const updatedUser = authService.getCurrentUser();
          setUser(updatedUser);
        } else if (event.data.type === 'LOGIN') {
          // User logged in from another tab
          const updatedUser = authService.getCurrentUser();
          setUser(updatedUser);
        }
      };
    } catch (error) {
      // BroadcastChannel not supported, fallback to storage events
      console.log('[AuthContext] BroadcastChannel not supported, using storage events');

      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'accessToken') {
          if (e.newValue === null) {
            // Token removed - user logged out
            setUser(null);
            navigate('/login');
          } else if (e.oldValue === null && e.newValue !== null) {
            // Token added - user logged in
            const updatedUser = authService.getCurrentUser();
            setUser(updatedUser);
          }
        } else if (e.key === 'auth_event') {
          try {
            const event = JSON.parse(e.newValue || '{}');
            if (event.type === 'LOGOUT') {
              setUser(null);
              navigate('/login');
            } else if (event.type === 'TOKEN_UPDATED') {
              const updatedUser = authService.getCurrentUser();
              setUser(updatedUser);
            }
          } catch (error) {
            console.error('[AuthContext] Failed to parse auth_event:', error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }

    return () => {
      if (authChannelRef.current) {
        authChannelRef.current.close();
      }
    };
  }, [navigate]);

  // Handle session expiration from API client
  useEffect(() => {
    const unsubscribe = onSessionExpired((expiredRedirectPath) => {
      console.log('[AuthContext] Session expired, redirecting to login');

      // Save the path where session expired for post-login redirect
      const pathToSave = expiredRedirectPath || location.pathname + location.search;
      if (pathToSave !== '/login' && pathToSave !== '/register') {
        setRedirectPath(pathToSave);
        sessionStorage.setItem('redirectAfterLogin', pathToSave);
      }

      // Clear user state
      setUser(null);

      // Redirect to login
      navigate('/login', { replace: true });
    });

    return unsubscribe;
  }, [navigate, location]);

  const login = useCallback(async (credentials: LoginCredentials, customRedirectPath?: string) => {
    const response = await authService.login(credentials);
    setUser(response.user);

    // Broadcast login to other tabs
    if (authChannelRef.current) {
      authChannelRef.current.postMessage({ type: 'LOGIN' });
    } else {
      localStorage.setItem('auth_event', JSON.stringify({
        type: 'LOGIN',
        timestamp: Date.now(),
      }));
    }

    // Determine redirect path
    const pathToRedirect = customRedirectPath
      || redirectPath
      || sessionStorage.getItem('redirectAfterLogin')
      || '/dashboard';

    // Clear redirect path
    setRedirectPath(null);
    sessionStorage.removeItem('redirectAfterLogin');

    // Navigate to intended destination
    navigate(pathToRedirect, { replace: true });
  }, [redirectPath, navigate]);

  const register = useCallback(async (data: RegisterData) => {
    const response = await authService.register(data);
    setUser(response.user);

    // Broadcast login to other tabs
    if (authChannelRef.current) {
      authChannelRef.current.postMessage({ type: 'LOGIN' });
    }

    // Redirect to dashboard after registration
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);

    // Broadcast logout to other tabs
    if (authChannelRef.current) {
      authChannelRef.current.postMessage({ type: 'LOGOUT' });
    } else {
      localStorage.setItem('auth_event', JSON.stringify({
        type: 'LOGOUT',
        timestamp: Date.now(),
      }));
    }

    // Clear redirect path on logout
    setRedirectPath(null);
    sessionStorage.removeItem('redirectAfterLogin');

    navigate('/login', { replace: true });
  }, [navigate]);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    redirectPath,
    setRedirectPath,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
