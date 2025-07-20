"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  settings?: any;
}

interface AuthContextType {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
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
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    // Check for existing session on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('AuthProvider: Checking JWT auth status...');
      
      // Verify JWT token with our backend - cookie will be sent automatically
      const response = await fetch('/api/auth/verify-jwt', {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      console.log('AuthProvider: JWT verification response:', response.status);

      if (response.ok) {
        const authData = await response.json();
        console.log('AuthProvider: JWT auth data:', authData);
        
        if (authData.authenticated && authData.user) {
          console.log('AuthProvider: User authenticated via JWT:', authData.user);
          setUser({
            ...authData.user,
            isEmailVerified: true // JWT users are already verified
          });
          setStatus("authenticated");
        } else {
          console.log('AuthProvider: JWT auth failed - not authenticated');
          removeCookie('auth-token');
          removeCookie('session-token');
          setUser(null);
          setStatus("unauthenticated");
        }
      } else {
        console.log('AuthProvider: No valid JWT token found');
        // Invalid token, remove cookies
        removeCookie('auth-token');
        removeCookie('session-token');
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (error) {
      console.error('JWT auth check failed:', error);
      setUser(null);
      setStatus("unauthenticated");
    }
  };

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
      // Always clear local state and both cookies
      removeCookie('auth-token');
      removeCookie('session-token');
      setUser(null);
      setStatus("unauthenticated");
      window.location.href = '/';
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const refreshUser = async () => {
    try {
      console.log('AuthProvider: Refreshing user data from backend...');
      
      // Verify JWT token with our backend to get fresh user data
      const response = await fetch('/api/auth/verify-jwt', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const authData = await response.json();
        console.log('AuthProvider: Fresh user data:', authData.user);
        
        if (authData.authenticated && authData.user) {
          setUser({
            ...authData.user,
            isEmailVerified: true
          });
        }
      } else {
        console.log('AuthProvider: Failed to refresh user data');
      }
    } catch (error) {
      console.error('AuthProvider: Error refreshing user data:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, status, signOut, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Helper functions for cookie manipulation
const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const removeCookie = (name: string) => {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};
