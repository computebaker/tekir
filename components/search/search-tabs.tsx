"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Image as ImageIcon, Newspaper, Video, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchTabsProps {
  active: string;
  onChange: (tab: string) => void;
}

export function SearchTabs({ active, onChange }: SearchTabsProps) {
  const t = useTranslations('search.tabs');

  const TABS = [
    { key: 'web', label: t('web'), Icon: Search },
    { key: 'images', label: t('images'), Icon: ImageIcon },
    { key: 'videos', label: t('videos'), Icon: Video },
    { key: 'news', label: t('news'), Icon: Newspaper },
  ];

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!moreOpen) return;
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
      if (moreRef.current && moreRef.current.contains(e.target as Node)) return;
      setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [moreOpen]);

  // Handle Escape key to close dropdown
  useEffect(() => {
    if (!moreOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [moreOpen]);

  // Desktop / large screens: show full tab list
  const fullTabs = (
    <div className="hidden md:flex space-x-4" role="tablist" aria-label="Search result types">
      {TABS.map((t) => {
        const Icon = t.Icon;
        const isActive = active === t.key;
        return (
          <button
            type="button"
            key={t.key}
            onClick={() => onChange(t.key)}
            className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className={isActive ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"}>
                {t.label}
              </span>
            </div>
            <div
              className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out ${
                isActive ? 'w-16 opacity-100' : 'w-0 opacity-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );

  const maxVisible = 4; 
  const tabSlots = maxVisible - 1; 
  const visibleTabs = TABS.slice(0, tabSlots);
  const overflowTabs = TABS.filter((t) => !visibleTabs.some((v) => v.key === t.key));

  const moreActive = overflowTabs.some((t) => t.key === active);

  const mobileTabs = (
    <div className="w-full md:hidden flex items-center justify-between" role="tablist" aria-label="Search result types">
      <div className="flex space-x-4 items-center">
        {visibleTabs.map((t) => {
          const Icon = t.Icon;
          const isActive = active === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => onChange(t.key)}
              className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className={isActive ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"}>
                  {t.label}
                </span>
              </div>
              <div
                className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out ${
                  isActive ? 'w-16 opacity-100' : 'w-0 opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* More button anchored to the right edge */}
      <div className="relative flex-shrink-0" ref={moreRef}>
        {overflowTabs.length > 0 && (
          <>
            <button
              type="button"
              ref={moreButtonRef}
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={`pb-2 px-2 flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted/40 ${moreActive ? 'text-primary' : 'text-muted-foreground'}`}
              aria-label="More search types"
            >
              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>

            {moreOpen && (
              <div
                ref={popoverRef}
                role="menu"
                aria-label="Additional search types"
                className="absolute right-0 top-full mt-2 w-40 bg-card border border-border rounded-lg shadow-lg z-50"
              >
                <div className="py-1">
                  {overflowTabs.map((t) => {
                    const Icon = t.Icon;
                    const isActive = active === t.key;
                    return (
                      <button
                        type="button"
                        key={`more-${t.key}`}
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => { onChange(t.key); setMoreOpen(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {fullTabs}
      {mobileTabs}
    </>
  );
}

export default SearchTabs;
