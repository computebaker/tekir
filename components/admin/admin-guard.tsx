"use client";

import { useEffect } from "react";
import { useAdminAccess } from "./use-admin-access";

export default function AdminGuard() {
  const { user, status, isAdmin } = useAdminAccess();

  useEffect(() => {
    // Ensure we have fresh auth info
    if (status === "loading") return;
    if (!user || !isAdmin) {
      window.location.href = "/";
      return;
    }
  }, [user, status, isAdmin]);

  return null;
}
