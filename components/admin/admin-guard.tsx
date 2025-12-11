"use client";

import { useEffect } from "react";
import { useAdminAccess } from "./use-admin-access";

export default function AdminGuard() {
  const { user, status, isAdmin, isChecking } = useAdminAccess();

  useEffect(() => {
    // Ensure we have fresh auth info - wait for both auth status and Convex auth to be ready
    if (status === "loading" || isChecking) return;
    if (!user || !isAdmin) {
      window.location.href = "/";
      return;
    }
  }, [user, status, isAdmin, isChecking]);

  return null;
}
