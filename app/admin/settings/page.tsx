"use client";

import React, { useMemo, useState } from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import pkg from "@/package.json" assert { type: "json" };

export default function AdminSettingsPage() {
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const meta = useMemo(() => {
    // App metadata for quick diagnostics
    const version = (pkg as any)?.version ?? "unknown";
    const name = (pkg as any)?.name ?? "tekir";
    const env = process.env.NODE_ENV;
    const buildId = (typeof window !== 'undefined' ? (window as any).__NEXT_DATA__?.buildId : undefined) || "n/a";
    return { name, version, env, buildId };
  }, []);

  async function purgeAnalytics() {
    setPurging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/purge-analytics", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed with ${res.status}`);
      }
      setMessage("Analytics data purged.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to purge analytics.");
    } finally {
      setPurging(false);
    }
  }

  return (
    <AdminShell>
      <AdminGuard />
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Admin Settings</h2>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground mb-2">Application</div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{meta.name}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">{meta.version}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Environment</span><span className="font-medium">{meta.env}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Build ID</span><span className="font-medium">{meta.buildId}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground mb-3">Maintenance</div>
          <div className="space-y-3">
            <button
              onClick={async () => {
                if (purging) return;
                if (!confirmPurge) {
                  setConfirmPurge(true);
                  return;
                }
                setConfirmPurge(false);
                await purgeAnalytics();
              }}
              disabled={purging}
              className={`px-3 py-2 rounded-md border text-sm ${
                purging
                  ? 'opacity-70 cursor-not-allowed'
                  : confirmPurge
                    ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                    : 'hover:bg-muted'
              }`}
            >
              {purging ? 'Purging…' : confirmPurge ? 'Sure?' : 'Purge all analytics data'}
            </button>
            {message && <div className="text-sm text-muted-foreground">{message}</div>}
            <div className="text-xs text-muted-foreground">
              This deletes all analytics tables used by the Analytics dashboard: search usage, AI usage, site visits, API hits, and top queries (including legacy token table).
              It does not affect users, sessions, chats, or feedback.
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
