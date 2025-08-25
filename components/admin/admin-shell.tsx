"use client";

import React from "react";
import { SettingsShell, type SettingsNavItem } from "@/components/settings/settings-shell";
import { BarChart3, MessageSquare, Users } from "lucide-react";
import { usePathname } from "next/navigation";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebar: SettingsNavItem[] = [
    { href: "/admin/analytics", icon: BarChart3, label: "Analytics", active: pathname === "/admin/analytics" },
    { href: "/admin/feedback", icon: MessageSquare, label: "Feedback", active: pathname === "/admin/feedback" },
    { href: "/admin/users", icon: Users, label: "Users", active: pathname === "/admin/users" },
  ];
  return (
    <SettingsShell title="Admin" currentSectionLabel={"Admin"} sidebar={sidebar}>
      {children}
    </SettingsShell>
  );
}
