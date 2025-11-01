"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type LogoOption = 'tekir' | 'duman' | 'pamuk';

interface LogoMetadata {
  id: LogoOption;
  name: string;
  path: string;
  width: number;
  height: number;
}

const LOGO_OPTIONS: LogoMetadata[] = [
  {
    id: 'tekir',
    name: 'Tekir',
    path: '/tekir-outlined.png',
    width: 200,
    height: 66,
  },
  {
    id: 'duman',
    name: 'Duman',
    path: '/alt/duman.png',
    width: 200,
    height: 66,
  },
  {
    id: 'pamuk',
    name: 'Pamuk',
    path: '/alt/pamuk.png',
    width: 200,
    height: 66,
  },
];

interface LogoSelectorProps {
  selectedLogo: LogoOption;
  onLogoChange: (logo: LogoOption) => void;
}

export function LogoSelector({ selectedLogo, onLogoChange }: LogoSelectorProps) {
  const tSettings = useTranslations("settings.searchPage");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLogo = LOGO_OPTIONS.find(logo => logo.id === selectedLogo) || LOGO_OPTIONS[0];

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (logo: LogoMetadata) => {
    onLogoChange(logo.id);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg",
          "bg-background border border-border hover:bg-muted transition-colors",
          "w-full sm:w-auto sm:min-w-[200px] justify-between"
        )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-foreground">
          {currentLogo.name}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-72 rounded-lg bg-background border border-border shadow-lg z-10">
          <div className="p-1">
            {LOGO_OPTIONS.map((logo) => (
              <button
                key={logo.id}
                type="button"
                onClick={() => handleSelect(logo)}
                role="menuitemradio"
                aria-checked={selectedLogo === logo.id}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left",
                  selectedLogo === logo.id && "bg-muted"
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  {logo.name}
                </span>
                {selectedLogo === logo.id && (
                  <div className="shrink-0 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get logo metadata
export function getLogoMetadata(logoId: LogoOption): LogoMetadata {
  return LOGO_OPTIONS.find(logo => logo.id === logoId) || LOGO_OPTIONS[0];
}
