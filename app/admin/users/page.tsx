"use client";

import React, { useState } from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { useAdminAccess } from "@/components/admin/use-admin-access";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/components/auth-provider";
import { showToast } from "@/lib/toast";

type User = {
  _id: string;
  email: string;
  username?: string;
  name?: string;
  roles?: string[];
  createdAt: number;
  updatedAt: number;
};

export default function AdminUsersPage() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { isAdmin } = useAdminAccess();
  const { authToken } = useAuth();
  const users = useQuery(
    api.users.listUsers,
    isAdmin && authToken ? { authToken, limit: 100 } : "skip"
  ) as User[] | undefined;
  const deleteUser = useMutation(api.users.deleteUser);
  const updateUser = useMutation(api.users.updateUser);
  const loading = !isAdmin || users === undefined;

  const remove = async (id: string) => {
    try {
      if (!authToken) throw new Error("Missing auth token");
      await deleteUser({ authToken, id: id as any });
      showToast.success("User deleted successfully");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showToast.error("Failed to delete user", message);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (confirmingId === id) {
      setConfirmingId(null);
      await remove(id);
    } else {
      setConfirmingId(id);
    }
  };

  return (
    <AdminShell>
      <AdminGuard />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Users</h2>
        </div>
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm" aria-busy={loading}>
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3">Joined</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Username</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Roles</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`s-${i}`} className="border-b last:border-0 border-border">
                    <td className="p-3">
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-56 bg-muted rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="h-6 w-16 bg-muted rounded animate-pulse inline-block" />
                    </td>
                  </tr>
                ))
              ) : !users || users.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No users</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-b last:border-0 border-border">
                    <td className="p-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.username || '-'}</td>
                    <td className="p-3">{u.name || '-'}</td>
                    <td className="p-3">{Array.isArray(u.roles) && u.roles.length ? u.roles.join(', ') : '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Toggle Admin */}
                        <button
                          type="button"
                          onClick={async () => {
                            const current = new Set((u.roles ?? []).map(r => r.toLowerCase()));
                            if (current.has('admin')) current.delete('admin'); else current.add('admin');
                            try {
                              await fetch('/api/admin/users/roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: u._id, roles: Array.from(current) })
                              });
                              showToast.success("Admin role updated");
                            } catch (e) {
                              console.error('Failed to update roles', e);
                              showToast.error("Failed to update role", "Please try again");
                            }
                          }}
                          className={`text-xs px-2 py-1 border rounded ${
                            (u.roles ?? []).map(r=>r.toLowerCase()).includes('admin')
                              ? 'bg-secondary text-secondary-foreground border-secondary hover:opacity-90'
                              : 'hover:bg-muted'
                          }`}
                          aria-pressed={(u.roles ?? []).map(r=>r.toLowerCase()).includes('admin')}
                          title={(u.roles ?? []).includes('admin') ? 'Remove admin role' : 'Grant admin role'}
                        >
                          {(u.roles ?? []).map(r=>r.toLowerCase()).includes('admin') ? 'Admin ✓' : 'Make Admin'}
                        </button>

                        {/* Toggle Paid */}
                        <button
                          type="button"
                          onClick={async () => {
                            const current = new Set((u.roles ?? []).map(r => r.toLowerCase()));
                            if (current.has('paid')) current.delete('paid'); else current.add('paid');
                            try {
                              await fetch('/api/admin/users/roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: u._id, roles: Array.from(current) })
                              });
                              showToast.success("Paid role updated");
                            } catch (e) {
                              console.error('Failed to update roles', e);
                              showToast.error("Failed to update role", "Please try again");
                            }
                          }}
                          className={`text-xs px-2 py-1 border rounded ${
                            (u.roles ?? []).map(r=>r.toLowerCase()).includes('paid')
                              ? 'bg-secondary text-secondary-foreground border-secondary hover:opacity-90'
                              : 'hover:bg-muted'
                          }`}
                          aria-pressed={(u.roles ?? []).map(r=>r.toLowerCase()).includes('paid')}
                          title={(u.roles ?? []).includes('paid') ? 'Revoke paid role' : 'Grant paid role'}
                        >
                          {(u.roles ?? []).map(r=>r.toLowerCase()).includes('paid') ? 'Paid ✓' : 'Grant Paid'}
                        </button>

                        {/* Delete with 2-step confirm */}
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(u._id)}
                          aria-pressed={confirmingId === u._id}
                          className={
                            `text-xs px-2 py-1 border rounded ` +
                            (confirmingId === u._id
                              ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                              : 'hover:bg-muted')
                          }
                        >
                          {confirmingId === u._id ? 'Sure?' : 'Delete'}
                        </button>
                      </div>
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
