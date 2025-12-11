"use client";

import React, { useState } from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { useAdminAccess } from "@/components/admin/use-admin-access";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/components/auth-provider";

type Feedback = {
  _id: string;
  userId?: string;
  userUsername?: string;
  userEmail?: string;
  sessionToken?: string;
  query?: string;
  liked: boolean;
  comment?: string;
  createdAt: number;
};

export default function AdminFeedbackPage() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { isAdmin } = useAdminAccess();
  const { authToken } = useAuth();
  const items = useQuery(
    api.feedbacks.listFeedbacks,
    isAdmin && authToken ? { authToken, limit: 100 } : "skip"
  ) as Feedback[] | undefined;
  const deleteFeedback = useMutation(api.feedbacks.deleteFeedback);
  // Optional error UI can be added with error boundaries; useQuery doesn't expose error directly

  const loading = !isAdmin || items === undefined;

  const handleDeleteClick = async (id: string) => {
    if (confirmingId === id) {
      setConfirmingId(null);
      try {
        if (!authToken) throw new Error("Missing auth token");
        await deleteFeedback({ authToken, id: id as any });
      } catch (e: any) {
        alert(`Delete failed: ${e.message || 'Unknown error'}`);
      }
    } else {
      setConfirmingId(id);
    }
  };

  return (
    <AdminShell>
      <AdminGuard />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Feedback</h2>
        </div>
        {/* Errors can be surfaced via an ErrorBoundary if desired */}
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm" aria-busy={loading}>
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Query</th>
                <th className="text-left p-3">Liked</th>
                <th className="text-left p-3">Comment</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`s-${i}`} className="border-b last:border-0 border-border">
                    <td className="p-3"><div className="h-3 w-32 bg-muted rounded animate-pulse" /></td>
                    <td className="p-3"><div className="h-3 w-24 bg-muted rounded animate-pulse" /></td>
                    <td className="p-3"><div className="h-3 w-60 bg-muted rounded animate-pulse" /></td>
                    <td className="p-3"><div className="h-5 w-5 bg-muted rounded-full animate-pulse" /></td>
                    <td className="p-3"><div className="h-3 w-64 bg-muted rounded animate-pulse" /></td>
                    <td className="p-3 text-right"><div className="h-6 w-16 bg-muted rounded animate-pulse inline-block" /></td>
                  </tr>
                ))
              ) : !items || items.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No feedback</td></tr>
              ) : (
                items.map((f) => (
                  <tr key={f._id} className="border-b last:border-0 border-border">
                    <td className="p-3">{new Date(f.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      {f.userUsername || f.userEmail || f.userId ? (
                        <span
                          className="underline decoration-dotted underline-offset-2 cursor-help"
                          title={`ID: ${f.userId || 'N/A'}`}
                        >
                          {f.userUsername || f.userEmail || f.userId}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 truncate max-w-[240px]" title={f.query}>{f.query || '-'}</td>
                    <td className="p-3">{f.liked ? '👍' : '👎'}</td>
                    <td className="p-3 truncate max-w-[260px]" title={f.comment}>{f.comment || '-'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteClick(f._id)}
                        className={
                          `text-xs px-2 py-1 border rounded ` +
                          (confirmingId === f._id
                            ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                            : 'hover:bg-muted')
                        }
                      >
                        {confirmingId === f._id ? 'Sure?' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
