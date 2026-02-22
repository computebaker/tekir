"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function useAdminAccess() {
  const { user, status, authToken } = useAuth();
  const [convexAuthReady, setConvexAuthReady] = useState(false);
  
  const roles = (user?.roles ?? []).map((role) => role?.toLowerCase());
  const isLocalAdmin = status === "authenticated" && roles.includes("admin");
  const isChecking = status === "loading" || (isLocalAdmin && !convexAuthReady);
  
  // Wait for Convex auth to be ready after authentication
  // This ensures the JWT token has been set in Convex before making queries
  useEffect(() => {
    if (status === "authenticated" && user?.id && authToken && isLocalAdmin) {
      // Small delay to ensure convex.setAuth has completed
      const timer = setTimeout(() => {
        setConvexAuthReady(true);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setConvexAuthReady(false);
    }
  }, [status, user?.id, authToken, isLocalAdmin]);

  // isAdmin is only true when both local auth AND Convex auth are ready
  const isAdmin = isLocalAdmin && convexAuthReady;

  return {
    user,
    status,
    roles,
    isAdmin,
    isChecking,
    convexAuthReady,
  } as const;
}
