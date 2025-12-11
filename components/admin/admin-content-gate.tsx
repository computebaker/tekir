"use client";

import { ReactNode } from "react";
import { useAdminAccess } from "./use-admin-access";

interface AdminContentGateProps {
  children: ReactNode;
  loadingFallback?: ReactNode;
  unauthorizedFallback?: ReactNode;
}

export function AdminContentGate({
  children,
  loadingFallback,
  unauthorizedFallback,
}: AdminContentGateProps) {
  const { status, isAdmin, isChecking } = useAdminAccess();

  // Show loading while checking auth status or waiting for Convex auth to be ready
  if (status === "loading" || isChecking) {
    return (
      <>{
        loadingFallback ?? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Verifying admin access…
          </div>
        )
      }</>
    );
  }

  if (!isAdmin) {
    return <>{unauthorizedFallback ?? null}</>;
  }

  return <>{children}</>;
}
