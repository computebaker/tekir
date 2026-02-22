"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown, Settings as SettingsIcon, ArrowLeft, type LucideIcon } from "lucide-react";
import { getRedirectUrlWithFallback, clearRedirectUrlOnNavigation } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const UserProfile = dynamic(() => import("@/components/user-profile"), { ssr: false });

export type SettingsNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  soon?: boolean;
  active?: boolean;
};

export type MobileNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export interface SettingsShellProps {
  title?: string;
  currentSectionLabel: string;
  sidebar: SettingsNavItem[];
  mobileNavItems?: MobileNavItem[];
  children: React.ReactNode;
  containerClassName?: string;
}

export function SettingsShell({
  title = "Settings",
  currentSectionLabel,
  sidebar,
  mobileNavItems = [],
  children,
  containerClassName = "",
}: SettingsShellProps) {
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const mobileSettingsRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileSettingsRef.current && !mobileSettingsRef.current.contains(event.target as Node)) {
        setIsMobileSettingsOpen(false);
      }
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSettingsOpen(false);
        // return focus to trigger
        mobileButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  // Clear redirect URL when navigating away from settings
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearRedirectUrlOnNavigation();
    };

    const handlePopState = () => {
      // Check if we're leaving settings pages
      if (!window.location.pathname.startsWith('/settings')) {
        clearRedirectUrlOnNavigation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const activeLabel = useMemo(() => sidebar.find((i) => i.active)?.label || currentSectionLabel, [sidebar, currentSectionLabel]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={getRedirectUrlWithFallback("/")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span></span>
            </Link>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserProfile mobileNavItems={mobileNavItems} />
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className={`container max-w-7xl py-8 px-4 sm:px-6 lg:px-8 mb-16 ${containerClassName}`}>
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <div className="rounded-lg border border-border bg-card p-4 mx-2 lg:mx-0">
                <nav className="space-y-1">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {title}
                    </h2>
                  </div>

                  {sidebar.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={item.active ? "page" : undefined}
                      className={
                        item.active
                          ? "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 transition-all duration-200 hover:bg-primary/15"
                          : item.soon
                            ? "flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-60 transition-opacity"
                            : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                      }
                      aria-disabled={item.soon}
                      onClick={(e) => {
                        if (item.soon) e.preventDefault();
                      }}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className={item.active ? "font-medium" : undefined}>{item.label}</span>
                      {item.soon && (
                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                      )}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-6 mx-2" ref={mobileSettingsRef}>
              <div className="relative">
                <button
                  ref={mobileButtonRef}
                  onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
                  className="w-full flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 border hover:bg-muted/70 transition-colors"
                  aria-expanded={isMobileSettingsOpen}
                  aria-haspopup="menu"
                  aria-controls="settings-mobile-menu"
                >
                  <div className="flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{title}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-foreground font-medium">{activeLabel}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isMobileSettingsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMobileSettingsOpen && (
                  <div
                    id="settings-mobile-menu"
                    role="menu"
                    aria-label="Settings sections"
                    className="absolute top-full mt-2 w-full rounded-lg bg-background border border-border shadow-lg z-50"
                  >
                    <div className="py-1">
                      {sidebar.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          aria-current={item.active ? "page" : undefined}
                          onClick={() => setIsMobileSettingsOpen(false)}
                          className={
                            item.active
                              ? "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left bg-muted text-foreground cursor-default"
                              : item.soon
                                ? "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground cursor-not-allowed opacity-50"
                                : "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          }
                          aria-disabled={item.soon}
                          onAuxClick={(e) => {
                            if (item.soon) e.preventDefault();
                          }}
                        >
                          <item.icon className="w-4 h-4" />
                          <span className={item.active ? "font-medium" : undefined}>{item.label}</span>
                          {item.soon && (
                            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
