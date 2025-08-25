"use client";

import React, { useState } from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  const users = useQuery(api.users.listUsers, { limit: 100 }) as User[] | undefined;
  const deleteUser = useMutation(api.users.deleteUser);
  const loading = users === undefined;

  const remove = async (id: string) => {
    try {
      await deleteUser({ id: id as any });
    } catch (e: any) {
      alert(`Delete failed: ${e.message || 'Unknown error'}`);
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
          <table className="w-full text-sm">
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
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
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
                      <button
                        onClick={() => handleDeleteClick(u._id)}
                        className={
                          `text-xs px-2 py-1 border rounded ` +
                          (confirmingId === u._id
                            ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                            : 'hover:bg-muted')
                        }
                      >
                        {confirmingId === u._id ? 'Sure?' : 'Delete'}
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
