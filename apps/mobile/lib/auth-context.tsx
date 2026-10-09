import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { authService } from './api-service';

export type UserRole = 'Owner' | 'Admin' | 'Employee' | 'Field Specialist';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeCode?: string;
  cluster?: string;
  tenant?: {
    id: string;
    name: string;
    code: string;
    cluster?: string;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  sessionToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  checkAuthSession: () => Promise<{ isAuthenticated: boolean; role?: UserRole }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; role?: UserRole; error?: string }>;
  signInDemo: (roleType: 'admin' | 'employee') => Promise<{ ok: boolean; role: UserRole }>;
  signUp: (payload: any) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  switchRole: (role: 'admin' | 'employee') => void;
}

const STORAGE_KEY_USER = 'flowhrms_user_profile';
const STORAGE_KEY_TOKEN = 'flowhrms_auth_token';

// Cross-platform storage helper
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo seed accounts for reliable development & demoing
export const DEMO_ACCOUNTS = {
  admin: {
    id: 'usr-admin-001',
    email: 'admin@flowacord.com',
    password: 'FlowHRMS2026!',
    name: 'CodeSchool Admin',
    role: 'Owner' as UserRole,
    employeeCode: 'EMP-0001',
    cluster: 'Jaipur Central Cluster',
    tenant: {
      id: '19cc363d-f16f-4f4d-a6ea-102e336e24d9',
      name: 'Demo Trading Co.',
      code: 'DEMO',
      cluster: 'Jaipur Central Cluster',
    },
  },
  employee: {
    id: 'usr-field-0428',
    email: 'ramesh.kumar@flowacord.com',
    password: 'JaipurField2026#',
    name: 'Ramesh Kumar',
    role: 'Employee' as UserRole,
    employeeCode: 'EMP-0428',
    cluster: 'Jaipur Central Warehouse',
    tenant: {
      id: '19cc363d-f16f-4f4d-a6ea-102e336e24d9',
      name: 'Demo Trading Co.',
      code: 'DEMO',
      cluster: 'Jaipur Central Warehouse',
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.email && (parsed.email.toLowerCase().includes('codeschoolrp') || parsed.email.toLowerCase().includes('admin'))) {
            parsed.role = 'Owner';
          }
          return parsed;
        }
      } catch {}
    }
    return null;
  });
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_TOKEN);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return !localStorage.getItem(STORAGE_KEY_USER);
    }
    return true;
  });

  const normalizeRole = (roleStr?: string): UserRole => {
    if (!roleStr) return 'Employee';
    const lower = roleStr.toLowerCase();
    if (lower.includes('admin') || lower.includes('owner')) return 'Owner';
    return 'Employee';
  };

  /**
   * 1. Splash Screen Token & Session Restoration
   * Restores stored user credentials / token without hardcoding role.
   */
  const checkAuthSession = useCallback(async (): Promise<{ isAuthenticated: boolean; role?: UserRole }> => {
    try {
      setIsLoading(true);

      // 1. Check local persistent store
      const storedUserJson = await storage.getItem(STORAGE_KEY_USER);
      const storedToken = await storage.getItem(STORAGE_KEY_TOKEN);

      if (storedUserJson) {
        let parsedUser: UserProfile = JSON.parse(storedUserJson);
        // Auto-heal legacy mock cached names
        if (
          parsedUser.email?.toLowerCase().includes('codeschoolrp') &&
          (parsedUser.name === 'Rishabh Kedia' || parsedUser.name === 'Rishabh')
        ) {
          parsedUser.name = 'CodeSchool Admin';
          await storage.setItem(STORAGE_KEY_USER, JSON.stringify(parsedUser));
        }
        setUser(parsedUser);
        setSessionToken(storedToken || 'token-restored');
        setIsLoading(false);
        return { isAuthenticated: true, role: parsedUser.role };
      }

      // 2. Check Supabase session if configured
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const supaUser = data.session.user;
        const role: UserRole = normalizeRole(supaUser.user_metadata?.role);
        const userProfile: UserProfile = {
          id: supaUser.id,
          email: supaUser.email || '',
          name: supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'User',
          role,
          employeeCode: supaUser.user_metadata?.employeeCode || 'EMP-001',
          cluster: 'Jaipur Central Cluster',
        };
        setUser(userProfile);
        setSessionToken(data.session.access_token);
        await storage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));
        await storage.setItem(STORAGE_KEY_TOKEN, data.session.access_token);
        setIsLoading(false);
        return { isAuthenticated: true, role };
      }

      setIsLoading(false);
      return { isAuthenticated: false };
    } catch (err) {
      console.warn('Session restoration failed:', err);
      setIsLoading(false);
      return { isAuthenticated: false };
    }
  }, []);

  // Run initial session check on mount
  useEffect(() => {
    checkAuthSession();
  }, [checkAuthSession]);

  /**
   * 2. Sign In (with Role Resolution)
   */
  const signIn = async (email: string, password: string): Promise<{ ok: boolean; role?: UserRole; error?: string }> => {
    try {
      setIsLoading(true);

      // Fast check for local demo accounts
      if (email.trim().toLowerCase() === DEMO_ACCOUNTS.admin.email.toLowerCase() && password === DEMO_ACCOUNTS.admin.password) {
        return await signInDemo('admin');
      }
      if (email.trim().toLowerCase() === DEMO_ACCOUNTS.employee.email.toLowerCase() && password === DEMO_ACCOUNTS.employee.password) {
        return await signInDemo('employee');
      }

      const res = await authService.signIn(email.trim(), password);
      if (res.ok && res.data) {
        const apiUser = res.data.user || {};
        const isOwnerAccount = email.toLowerCase().includes('admin') || email.toLowerCase().includes('codeschoolrp');
        const role = normalizeRole(apiUser.role || (isOwnerAccount ? 'Owner' : 'Employee'));
        const userProfile: UserProfile = {
          id: apiUser.id || 'usr-' + Date.now(),
          email: apiUser.email || email,
          name: apiUser.name || (isOwnerAccount ? 'Admin' : (email.split('@')[0] || 'Employee')),
          role,
          employeeCode: apiUser.employeeCode || (role === 'Owner' ? 'EMP-0001' : 'EMP-0428'),
          cluster: res.data.tenant?.cluster || 'Jaipur Central Cluster',
          tenant: res.data.tenant,
        };

        const token = res.data.session?.accessToken || 'jwt-session-token';
        setUser(userProfile);
        setSessionToken(token);
        await storage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));
        await storage.setItem(STORAGE_KEY_TOKEN, token);
        setIsLoading(false);
        return { ok: true, role };
      }

      setIsLoading(false);
      return { ok: false, error: res.error || 'Invalid credentials' };
    } catch (err: any) {
      setIsLoading(false);
      return { ok: false, error: err?.message || 'Network error during sign in' };
    }
  };

  /**
   * Demo Sign In for instant testing
   */
  const signInDemo = async (roleType: 'admin' | 'employee'): Promise<{ ok: boolean; role: UserRole }> => {
    setIsLoading(true);
    const demoData = roleType === 'admin' ? DEMO_ACCOUNTS.admin : DEMO_ACCOUNTS.employee;
    const userProfile: UserProfile = {
      id: demoData.id,
      email: demoData.email,
      name: demoData.name,
      role: demoData.role,
      employeeCode: demoData.employeeCode,
      cluster: demoData.cluster,
      tenant: demoData.tenant,
    };
    setUser(userProfile);
    setSessionToken('demo-token-' + roleType);
    await storage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));
    await storage.setItem(STORAGE_KEY_TOKEN, 'demo-token-' + roleType);
    setIsLoading(false);
    return { ok: true, role: userProfile.role };
  };

  /**
   * Sign Up
   */
  const signUp = async (payload: any): Promise<{ ok: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const res = await authService.signUp(payload);
      if (res.ok) {
        // Automatically sign in as admin/owner for new workspace
        const userProfile: UserProfile = {
          id: 'usr-new-' + Date.now(),
          email: payload.email,
          name: payload.fullName,
          role: 'Owner',
          employeeCode: 'EMP-0001',
          cluster: 'Headquarters',
          tenant: {
            id: 'tenant-' + Date.now(),
            name: payload.companyName,
            code: payload.companyName.substring(0, 4).toUpperCase(),
          },
        };
        setUser(userProfile);
        setSessionToken('new-user-token');
        await storage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));
        await storage.setItem(STORAGE_KEY_TOKEN, 'new-user-token');
        setIsLoading(false);
        return { ok: true };
      }
      setIsLoading(false);
      return { ok: false, error: res.error || 'Sign up failed' };
    } catch (err: any) {
      setIsLoading(false);
      return { ok: false, error: err?.message || 'Network error during sign up' };
    }
  };

  /**
   * Sign Out
   */
  const signOut = async (): Promise<void> => {
    try {
      await storage.removeItem(STORAGE_KEY_USER);
      await storage.removeItem(STORAGE_KEY_TOKEN);
      await supabase.auth.signOut().catch(() => {});
    } finally {
      setUser(null);
      setSessionToken(null);
    }
  };

  /**
   * Role Switcher (for previewing between Admin Dashboard & Employee Home)
   */
  const switchRole = (role: 'admin' | 'employee') => {
    if (!user) return;
    const newRole: UserRole = role === 'admin' ? 'Owner' : 'Employee';
    const updatedUser: UserProfile = {
      ...user,
      role: newRole,
      name: user.name || (role === 'admin' ? 'Admin' : 'Employee'),
      employeeCode: user.employeeCode || (role === 'admin' ? 'EMP-0001' : 'EMP-0428'),
    };
    setUser(updatedUser);
    storage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
  };

  const isAdmin =
    user?.role === 'Owner' ||
    user?.role === 'Admin' ||
    (user?.email ? user.email.toLowerCase().includes('codeschoolrp') || user.email.toLowerCase().includes('admin') : false);
  const isEmployee = !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isEmployee,
        checkAuthSession,
        signIn,
        signInDemo,
        signUp,
        signOut,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
