"use client";

import { useAuth } from "@/components/auth-provider";

export function useAdminAccess() {
  const { user, status } = useAuth();
  const roles = (user?.roles ?? []).map((role) => role?.toLowerCase());
  const isAdmin = status === "authenticated" && roles.includes("admin");
  const isChecking = status === "loading";

  return {
    user,
    status,
    roles,
    isAdmin,
    isChecking,
  } as const;
}
