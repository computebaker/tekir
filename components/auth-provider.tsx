"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import convex from "@/lib/convex-proxy";

// Define user settings interface
interface UserSettings {
  searchEngine?: string;
  country?: string;
  language?: string;
  safesearch?: string;
  theme?: string;
  wikipediaEnabled?: boolean;
  karakulakEnabled?: boolean;
  aiModel?: string;
  [key: string]: string | boolean | undefined;
}

interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  image?: string;
  imageType?: string;
  avatar?: string;
  updatedAt?: number;
  isEmailVerified: boolean;
  roles?: string[];
  settings?: UserSettings;
  polarCustomerId?: string;
}

interface AuthContextType {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  authToken: string | null;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  checkAuthStatus: (force?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const isCheckingRef = useRef(false); // Use ref instead of state to prevent re-renders
  const lastCheckTimeRef = useRef(0); // Track last check time to prevent spam

  const checkAuthStatus = useCallback(async (force = false) => {
    // Prevent multiple simultaneous auth checks
    if (isCheckingRef.current) {
      return;
    }

    // Throttle calls - don't check more than once every 30 seconds unless forced
    const now = Date.now();
    if (!force && now - lastCheckTimeRef.current < 30000) {
      return;
    }

    isCheckingRef.current = true;
    lastCheckTimeRef.current = now;
    try {
      // Verify JWT token with our backend - cookie will be sent automatically
      const response = await fetch('/api/auth/verify-jwt', {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const authData = await response.json();

        if (authData.authenticated && authData.user) {
          // Set Convex auth token
          if (authData.token) {
            setAuthToken(authData.token);
            await convex.setAuth(async () => authData.token);
          } else {
            setAuthToken(null);
            await convex.setAuth(async () => null);
          }

          const newUser = {
            ...authData.user,
            isEmailVerified: true // JWT users are already verified
          };

          // Only update user if the data has actually changed
          setUser(prevUser => {
            const prevRoles = (prevUser?.roles ?? []).join(',');
            const nextRoles = (newUser?.roles ?? []).join(',');
            if (!prevUser ||
              prevUser.id !== newUser.id ||
              prevUser.email !== newUser.email ||
              prevUser.name !== newUser.name ||
              prevUser.username !== newUser.username ||
              prevUser.image !== newUser.image ||
              prevUser.imageType !== newUser.imageType ||
              (prevUser as any).updatedAt !== (newUser as any).updatedAt ||
              prevRoles !== nextRoles) {
              return newUser;
            }
            return prevUser;
          });
          setStatus("authenticated");
        } else {
          setAuthToken(null);
          await convex.setAuth(async () => null);
          setUser(null);
          setStatus("unauthenticated");
        }
      } else {
        setAuthToken(null);
        await convex.setAuth(async () => null);
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (error) {
      console.error('JWT auth check failed:', error);
      setAuthToken(null);
      setUser(null);
      setStatus("unauthenticated");
    } finally {
      isCheckingRef.current = false;
    }
  }, []); // No dependencies to prevent recreation

  useEffect(() => {
    // Check for existing session on mount only - force this initial check
    checkAuthStatus(true);

    // Listen for custom authentication events only
    const handleAuthLogin = () => {
      // Force immediate check on login
      checkAuthStatus(true);
    };

    const handleAuthLogout = () => {
      // Clear local state; server clears cookies
      setUser(null);
      setStatus("unauthenticated");
    };

    window.addEventListener('auth-login', handleAuthLogin);
    window.addEventListener('auth-logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth-login', handleAuthLogin);
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, [checkAuthStatus]); // Depend on stable callback

  const signOut = async () => {
    try {
      // Call logout endpoint - cookie will be sent automatically
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Signout error:', error);
    } finally {
      // Always clear local state; server cleared cookies
      setAuthToken(null);
      await convex.setAuth(async () => null);
      setUser(null);
      setStatus("unauthenticated");
      window.location.href = '/';
    }
  };

  const updateUser = useCallback((userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    // Prevent multiple simultaneous refresh calls
    if (isCheckingRef.current) {
      return;
    }

    // Throttle calls - don't refresh more than once every 10 seconds
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 10000) {
      return;
    }

    isCheckingRef.current = true;
    lastCheckTimeRef.current = now;
    try {
      // Verify JWT token with our backend to get fresh user data
      const response = await fetch('/api/auth/verify-jwt', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const authData = await response.json();

        if (authData.authenticated && authData.user) {
          if (authData.token) {
            setAuthToken(authData.token);
            await convex.setAuth(async () => authData.token);
          }
          const newUser = {
            ...authData.user,
            isEmailVerified: true
          };

          // Only update user if the data has actually changed
          setUser(prevUser => {
            const prevRoles = (prevUser?.roles ?? []).join(',');
            const nextRoles = (newUser?.roles ?? []).join(',');
            if (!prevUser ||
              prevUser.id !== newUser.id ||
              prevUser.email !== newUser.email ||
              prevUser.name !== newUser.name ||
              prevUser.username !== newUser.username ||
              prevUser.image !== newUser.image ||
              prevUser.imageType !== newUser.imageType ||
              (prevUser as any).updatedAt !== (newUser as any).updatedAt ||
              prevRoles !== nextRoles) {
              return newUser;
            }
            return prevUser;
          });
          setStatus("authenticated");
        }
      } else {
      }
    } catch (error) {
      console.error('AuthProvider: Error refreshing user data:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, []); // No dependencies to prevent recreation

  return (
    <AuthContext.Provider value={{ user, status, authToken, signOut, updateUser, refreshUser, checkAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

// No client-side manipulation of httpOnly cookies; rely on server endpoints
