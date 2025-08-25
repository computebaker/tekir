"use client";

import React, { useState } from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Feedback = {
  _id: string;
  userId?: string;
  sessionToken?: string;
  query?: string;
  liked: boolean;
  comment?: string;
  createdAt: number;
};

export default function AdminFeedbackPage() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const items = useQuery(api.feedbacks.listFeedbacks, { limit: 100 }) as Feedback[] | undefined;
  const deleteFeedback = useMutation(api.feedbacks.deleteFeedback);
  // Optional error UI can be added with error boundaries; useQuery doesn't expose error directly

  const loading = items === undefined;

  const handleDeleteClick = async (id: string) => {
    if (confirmingId === id) {
      setConfirmingId(null);
      try {
        await deleteFeedback({ id: id as any });
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
          <table className="w-full text-sm">
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
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : !items || items.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No feedback</td></tr>
              ) : (
                items.map((f) => (
                  <tr key={f._id} className="border-b last:border-0 border-border">
                    <td className="p-3">{new Date(f.createdAt).toLocaleString()}</td>
                    <td className="p-3">{f.userId || '-'}</td>
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
