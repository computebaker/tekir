"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import UserProfile from "@/components/user-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import React from "react";

type TopNavSimpleProps = {
  backHref: string;
  backLabel?: string;
  centerLogoSrc?: string;
  centerLogoAlt?: string;
  centerLogoHeight?: number;
  showThemeToggle?: boolean;
  rightSlot?: React.ReactNode;
  className?: string;
};

export function TopNavSimple({
  backHref,
  backLabel = "Back",
  centerLogoSrc = "/tekir-outlined.png",
  centerLogoAlt = "Tekir",
  centerLogoHeight = 40,
  showThemeToggle = false,
  rightSlot,
  className = "",
}: TopNavSimpleProps) {
  return (
    <header className={`sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4 text-muted-foreground hover:text-foreground transition-colors">
            <Link href={backHref} className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span>{backLabel}</span>
            </Link>
          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Link href="/" className="flex items-center">
              <Image
                src={centerLogoSrc}
                alt={centerLogoAlt}
                width={0}
                height={0}
                sizes="100vw"
                className="w-auto"
                style={{ height: centerLogoHeight }}
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {showThemeToggle ? <ThemeToggle /> : null}
            {rightSlot ?? <UserProfile />}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopNavSimple;
