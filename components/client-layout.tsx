"use client";

import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/components/auth-provider";
import { ConvexProvider } from "convex/react";
import convex from "@/lib/convex-proxy";
import { useEffect } from 'react';
import { prefetchBangs } from '@/utils/bangs';

// Helper functions for cookie manipulation using document.cookie
const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
};

const removeCookie = (name: string) => {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};

// Function to generate a simple random token (replace with a more robust solution if needed)
const generateSessionToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch bangs when the app initializes
  useEffect(() => {
    prefetchBangs();
  }, []);

  useEffect(() => {
    const initializeSession = async () => {
      let sessionToken = getCookie('session-token');
      if (!sessionToken) {
        sessionToken = generateSessionToken();
        setCookie('session-token', sessionToken, 7); // Expires in 7 days

        if (sessionToken) {
          try {
            const response = await fetch('/api/session/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token: sessionToken }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
              console.error("Failed to register session token with Convex:", result.error || response.statusText);
              removeCookie('session-token'); // Clear cookie if registration failed
            } else {
              console.log("Session token registered via API:", sessionToken);
            }
          } catch (error) {
            console.error("Error calling session registration API:", error);
            removeCookie('session-token'); // Clear cookie on API call error
          }
        }
      } else {
        console.log("Existing session token:", sessionToken);
      }
    };
    initializeSession();
  }, []);

  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </AuthProvider>
    </ConvexProvider>
  );
}
