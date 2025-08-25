"use client";

import React from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
function yyyymmdd(ts: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return Number(`${y}${m}${day}`);
}

type Analytics = { users: number; feedbacks: number };

export default function AdminAnalyticsPage() {
  const users = useQuery(api.users.countUsers, {});
  const feedbacks = useQuery(api.feedbacks.countFeedbacks, {});
  const today = yyyymmdd(Date.now());
  const searchUsageToday = useQuery(api.usage.getSearchUsageByDay as any, { day: today }) as any[] | undefined;
  const aiUsageToday = useQuery(api.usage.getAiUsageByDay as any, { day: today }) as any[] | undefined;
  const topTokens = useQuery(api.usage.topSearchTokensByDay as any, { day: today, limit: 20 }) as any[] | undefined;
  const loading = [users, feedbacks, searchUsageToday, aiUsageToday, topTokens].some(v => v === undefined);

  return (
    <AdminShell>
      <AdminGuard />
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Overview</h2>
    {!loading ? null : null}
    {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-6 animate-pulse h-24" />
            <div className="rounded-lg border border-border bg-card p-6 animate-pulse h-24" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground">Total Users</div>
      <div className="text-3xl font-bold">{users}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground">Feedback Entries</div>
      <div className="text-3xl font-bold">{feedbacks}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 col-span-2">
              <div className="text-sm text-muted-foreground mb-2">Today’s Search Usage (by provider/type)</div>
              <div className="text-sm grid sm:grid-cols-2 gap-2">
                {(searchUsageToday || []).map((r: any) => (
                  <div key={`${r.provider}-${r.type}`} className="flex items-center justify-between">
                    <span>{r.provider} / {r.type}</span>
                    <span className="font-semibold">{r.count} searches</span>
                  </div>
                ))}
                {(!searchUsageToday || searchUsageToday.length === 0) && <div className="text-muted-foreground">No data yet</div>}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">Today’s AI Usage (by model)</div>
              <div className="text-sm space-y-1">
                {(aiUsageToday || []).map((r: any) => (
                  <div key={r.model} className="flex items-center justify-between">
                    <span>{r.model}</span>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                ))}
                {(!aiUsageToday || aiUsageToday.length === 0) && <div className="text-muted-foreground">No data yet</div>}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">Top Search Tokens Today</div>
              <div className="text-sm space-y-1">
                {(topTokens || []).map((t: any) => (
                  <div key={t.token} className="flex items-center justify-between">
                    <span>{t.token}</span>
                    <span className="font-semibold">{t.count}</span>
                  </div>
                ))}
                {(!topTokens || topTokens.length === 0) && <div className="text-muted-foreground">No data yet</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
