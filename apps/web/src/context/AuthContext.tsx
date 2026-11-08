import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.js';
import { UserRole } from '@factorypulse/shared';

export interface UserProfile {
  id: string;
  tenantId?: string;
  tenantName?: string;
  name: string;
  email: string;
  role: UserRole;
  mfaEnabled: boolean;
  assignedMachines?: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  selectedTenantId: string | null;
  setSelectedTenantId: (tenantId: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('fp_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const storedToken = api.getToken();
    const storedUser = localStorage.getItem('fp_user');
    return !(storedToken && storedUser);
  });
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);

  const setSelectedTenantId = (tId: string | null) => {
    setSelectedTenantIdState(tId);
    api.setSelectedTenantId(tId);
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('fp_user');
      setUser(null);
      setToken(null);
      socketService.disconnect();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    async function loadUser() {
      const storedToken = api.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.getMe();
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('fp_user', JSON.stringify(res.data));
          socketService.connect(storedToken);
        } else {
          api.setToken(null);
          localStorage.removeItem('fp_user');
          setToken(null);
          setUser(null);
        }
      } catch (err: any) {
        console.error('Session validation check:', err);
        if (err?.status === 401) {
          api.setToken(null);
          localStorage.removeItem('fp_user');
          setToken(null);
          setUser(null);
        } else {
          // If offline or dev hot-reload, preserve cached user
          const cached = localStorage.getItem('fp_user');
          if (cached) {
            try {
              setUser(JSON.parse(cached));
              socketService.connect(storedToken);
            } catch {
              // ignore
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string = 'Password123!') => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      if (res.success && res.data) {
        const { token: newToken, user: newUser } = res.data;
        api.setToken(newToken);
        localStorage.setItem('fp_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
        socketService.connect(newToken);
      } else {
        throw new Error(res.error || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoRole = async (role: UserRole) => {
    const creds = DEMO_CREDENTIALS[role];
    if (creds) {
      await login(creds.email, 'Password123!');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      // Continue client-side logout
    }
    api.setToken(null);
    localStorage.removeItem('fp_user');
    setToken(null);
    setUser(null);
    socketService.disconnect();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchDemoRole,
        selectedTenantId,
        setSelectedTenantId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
