"use client";

import React from "react";

export type BadgeChipProps = {
  children: React.ReactNode;
  color?: "slate" | "gray" | "secondary" | "muted";
  className?: string;
};

export function BadgeChip({ children, color = "slate", className = "" }: BadgeChipProps) {
  const palette: Record<string, string> = {
    slate: "bg-slate-500/10 text-muted-foreground",
    gray: "bg-gray-500/10 text-muted-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <span className={`${palette[color]} px-3 py-1 rounded-full text-sm ${className}`}>{children}</span>
  );
}

export default BadgeChip;
