"use client";

import { useAuth } from "@/components/auth-provider";
import { useEffect } from "react";

export default function AdminGuard() {
  const { user, status, checkAuthStatus } = useAuth();

  useEffect(() => {
    // Ensure we have fresh auth info
    if (status === "loading") return;
    if (!user) {
      window.location.href = "/";
      return;
    }
    const roles = (user as any).roles as string[] | undefined;
    if (!Array.isArray(roles) || !roles.includes("admin")) {
      window.location.href = "/";
    }
  }, [user, status, checkAuthStatus]);

  return null;
}
