"use client";

import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { AdminContentGate } from "@/components/admin/admin-content-gate";
import { AnalyticsContent } from "@/components/admin/analytics-content";

export default function AdminAnalyticsPage() {
  return (
    <AdminShell>
      <AdminGuard />
      <AdminContentGate>
        <AnalyticsContent />
      </AdminContentGate>
    </AdminShell>
  );
}
