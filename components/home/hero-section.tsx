import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLogoMetadata } from "@/components/settings/logo-selector";
import { SearchInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
    keyboardAware: boolean;
    vvHeight: number | null;
    logoLoaded: boolean;
    selectedLogoState: 'tekir' | 'duman' | 'pamuk' | null;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setShowSuggestions: (show: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleSearch: (e: React.FormEvent) => void;
    isHeroInputFocused: boolean;
    setIsHeroInputFocused: (focused: boolean) => void;
    isMobile: boolean;
    isFocusLocked: boolean;
    setIsFocusLocked: (locked: boolean) => void;
    isSubmitting: boolean;
    setSelectedIndex: (index: number) => void;
    suggestionsRef: React.RefObject<HTMLDivElement>;
    heroFormRef: React.RefObject<HTMLFormElement>;
    searchInputRef: React.RefObject<HTMLInputElement>;
    unlockingRef: React.MutableRefObject<boolean>;
    pushedStateRef: React.MutableRefObject<boolean>;
    hasBang: boolean;
}

export function HeroSection({
    keyboardAware,
    vvHeight,
    logoLoaded,
    selectedLogoState,
    searchQuery,
    setSearchQuery,
    setShowSuggestions,
    handleKeyDown,
    handleSearch,
    isHeroInputFocused,
    setIsHeroInputFocused,
    isMobile,
    isFocusLocked,
    setIsFocusLocked,
    isSubmitting,
    setSelectedIndex,
    suggestionsRef,
    heroFormRef,
    searchInputRef,
    unlockingRef,
    pushedStateRef,
    hasBang
}: HeroSectionProps) {
    const tHome = useTranslations("home");
    const tSearch = useTranslations("search");

    return (
        <section
            className={cn(
                "flex flex-col items-center px-4 relative bg-gradient-to-b from-background via-background to-gray-50/30 dark:to-gray-950/10 transition-[height,padding] duration-200 ease-out",
                keyboardAware ? "justify-start pt-3" : "justify-center h-[calc(100dvh-64px)]",
            )}
            style={{
                height: keyboardAware && vvHeight ? `${Math.max(320, vvHeight - 140)}px` : undefined
            }}
        >
            <div className={cn(
                "w-full max-w-3xl text-center",
                keyboardAware ? "space-y-2 -mt-1" : "space-y-8 -mt-6 sm:-mt-10 md:-mt-14"
            )}>
                {/* Logo */}
                <div
                    className={cn(
                        "flex justify-center overflow-hidden transition-[opacity,transform,max-height] duration-200 ease-out",
                        keyboardAware ? "opacity-0 -translate-y-2 max-h-0" : "opacity-100 translate-y-0 max-h-[120px]"
                    )}
                >
                    <div>
                        {logoLoaded && selectedLogoState ? (
                            (() => {
                                const logoMetadata = getLogoMetadata(selectedLogoState);
                                return (
                                    <Image
                                        key={logoMetadata.path}
                                        src={logoMetadata.path}
                                        alt={`${logoMetadata.name} logo`}
                                        width={logoMetadata.width}
                                        height={logoMetadata.height}
                                        priority
                                        fetchPriority="high"
                                        suppressHydrationWarning
                                    />
                                );
                            })()
                        ) : (
                            <div style={{ width: 200, height: 66 }} className="bg-transparent" />
                        )}
                    </div>
                </div>

                {/* Search Bar */}
                <form ref={heroFormRef} onSubmit={handleSearch} className={cn("relative w-full transition-[margin,transform] duration-200 ease-out", keyboardAware && "mt-6")}>
                    <div className="relative group">
                        {/* Search input */}
                        <SearchInput
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            autoComplete="off"
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => {
                                setShowSuggestions(true);
                                setIsHeroInputFocused(true);
                                if (isMobile) {
                                    if (!isFocusLocked) {
                                        setIsFocusLocked(true);
                                        try { history.pushState({ focusLock: true }, "", location.href); pushedStateRef.current = true; } catch { }
                                    }
                                    window.setTimeout(() => {
                                        try {
                                            const ua = navigator.userAgent || "";
                                            const isApple = /iPhone|iPad|iPod|Mac/.test(ua);
                                            if (!isApple) {
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                        } catch { }
                                    }, 50);
                                }
                            }}
                            onBlur={(e) => {
                                if (isSubmitting) return;

                                // Give time for click events on suggestions to fire first
                                window.setTimeout(() => {
                                    // Check if the newly focused element is within suggestions
                                    const newFocus = document.activeElement;
                                    const clickedInSuggestions = suggestionsRef.current?.contains(newFocus as Node);

                                    if (clickedInSuggestions) {
                                        // Keep the dropdown open and refocus input after interaction
                                        return;
                                    }

                                    if (isMobile && isFocusLocked && !unlockingRef.current) {
                                        const ua = navigator.userAgent || "";
                                        const isApple = /iPhone|iPad|iPod|Mac/.test(ua);
                                        if (!isApple) {
                                            window.setTimeout(() => searchInputRef.current?.focus(), 0);
                                        }
                                        return;
                                    }

                                    setIsHeroInputFocused(false);
                                    setIsFocusLocked(false);
                                    setShowSuggestions(false);
                                    setSelectedIndex(-1);
                                }, 150);
                            }}
                            placeholder={tHome("searchPlaceholder")}
                            className={cn(
                                "w-full pr-24 shadow-lg transition-all duration-300 relative z-10",
                                hasBang && "ring-2 ring-orange-500/50 border-orange-500/50 focus-visible:ring-orange-500"
                            )}
                        />

                        {/* Search button */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-20">
                            <Button type="submit" variant="ghost" size="icon" shape="pill" title={tSearch("searchButton")}>
                                <Search className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </section>
    );
}
