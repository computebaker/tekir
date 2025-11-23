"use client";

import { useEffect, useState, useRef, useTransition, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { useSettings } from "@/lib/settings";
import { HeroSection } from "@/components/home/hero-section";
import { useSearchSuggestions, Suggestion } from "@/hooks/use-search-suggestions";
import { cn } from "@/lib/utils";
import { Search, MessageCircleMore, RefreshCw } from "lucide-react";

const UserProfile = dynamic(() => import("@/components/user-profile"), { ssr: false });
const WeatherWidget = dynamic(() => import("@/components/weather-widget"), { ssr: false });
const MainFooter = dynamic(() => import("@/components/main-footer"), { ssr: false });

export default function Home() {
  const tHome = useTranslations("home");
  const tSearch = useTranslations("search");
  const { user } = useAuth();
  const { settings, isInitialized } = useSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Mobile keyboard awareness
  const [isMobile, setIsMobile] = useState(false);
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  const [kbVisible, setKbVisible] = useState(false);
  const [isHeroInputFocused, setIsHeroInputFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autocompleteSource] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );

  const hasBang = useMemo(() => /(?:^|\s)![a-z]+/.test(searchQuery.toLowerCase()), [searchQuery]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const heroFormRef = useRef<HTMLFormElement>(null);

  // Lock raised state while submitting so it doesn't animate back before redirect
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Focus lock on mobile: keep input focused until back/outside tap
  const [isFocusLocked, setIsFocusLocked] = useState(false);
  const unlockingRef = useRef(false);
  const pushedStateRef = useRef(false);

  // Logo chooser state - load from localStorage on mount
  const [selectedLogoState, setSelectedLogoState] = useState<'tekir' | 'duman' | 'pamuk' | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Tri-state: null = unknown (no explicit local value) | true | false
  const [localShowRecs, setLocalShowRecs] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('showRecommendations');
      if (stored === null) return null;
      return stored === 'true';
    }
    return null;
  });

  // Determine effective preference
  const effectiveShowRecs: boolean | null = localShowRecs !== null ? localShowRecs : (isInitialized ? (settings.showRecommendations ?? false) : null);

  // Use custom hook for suggestions
  const {
    suggestions,
    recs,
    recLoading,
    recIndex,
    setRecIndex,
    recSwitching,
    setRecSwitching,
    canShowRecommendations,
    recommendationWindowSize
  } = useSearchSuggestions(searchQuery, autocompleteSource, effectiveShowRecs);

  // Load logo from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('selectedLogo');
    if (stored === 'tekir' || stored === 'duman' || stored === 'pamuk') {
      setSelectedLogoState(stored);
    } else {
      setSelectedLogoState('tekir');
    }
    setLogoLoaded(true);
  }, []);

  // Update logo state when settings change
  useEffect(() => {
    if (settings.selectedLogo && settings.selectedLogo !== selectedLogoState) {
      setSelectedLogoState(settings.selectedLogo);
      localStorage.setItem('selectedLogo', settings.selectedLogo);
    }
  }, [settings.selectedLogo, selectedLogoState]);

  // Placeholder for handleBangRedirect
  const handleBangRedirect = async (query: string): Promise<boolean> => {
    console.log(`Placeholder: handleBangRedirect for "${query}"`);
    if (query.startsWith("!g ")) {
      window.location.href = `https://google.com/search?q=${encodeURIComponent(query.substring(3))}`;
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("karakulakEnabled");
      if (stored == null) {
        localStorage.setItem("karakulakEnabled", "true");
      }
    }
  }, []);

  // Sync local state when settings are initialized from server
  useEffect(() => {
    if (isInitialized) {
      const serverValue = settings.showRecommendations ?? false;
      setLocalShowRecs(serverValue);
      try {
        if (localStorage.getItem('showRecommendations') === null) {
          localStorage.setItem('showRecommendations', String(serverValue));
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isInitialized, settings.showRecommendations]);

  useEffect(() => {
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const start = 120;
        const span = 220;
        const raw = Math.min(1, Math.max(0, (y - start) / span));
        const eased = easeOutCubic(raw);
        setScrollProgress(eased);
        setIsScrolled(y > start);
        rafId = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // When focus is locked on mobile, use history entry so Back unlocks instead of leaving immediately
  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      if (!isMobile) return;
      if (isFocusLocked) {
        unlockingRef.current = true;
        setIsFocusLocked(false);
        setIsHeroInputFocused(false);
        try { searchInputRef.current?.blur(); } catch { }
        window.setTimeout(() => { unlockingRef.current = false; }, 80);
        pushedStateRef.current = false;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isMobile, isFocusLocked]);

  useEffect(() => {
    const handler = (ev: Event) => {
      if (!isMobile) return;
      const target = ev.target as Node | null;
      const insideSuggestions = suggestionsRef.current?.contains(target as Node) ?? false;
      const insideForm = heroFormRef.current?.contains(target as Node) ?? false;

      if (!insideForm && !insideSuggestions) {
        if (isFocusLocked) {
          unlockingRef.current = true;
          setIsFocusLocked(false);
          setIsHeroInputFocused(false);
          if (pushedStateRef.current) {
            try { history.back(); } catch { }
            pushedStateRef.current = false;
          }
          window.setTimeout(() => {
            try { searchInputRef.current?.blur(); } catch { }
            window.setTimeout(() => { unlockingRef.current = false; }, 80);
          }, 10);
        } else if (isHeroInputFocused) {
          setIsHeroInputFocused(false);
          try { searchInputRef.current?.blur(); } catch { }
        }

        if (showSuggestions) {
          setShowSuggestions(false);
        }
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler as any);
      document.removeEventListener('mousedown', handler as any);
    };
  }, [isMobile, isFocusLocked, isHeroInputFocused, showSuggestions]);

  // Track mobile viewport and virtual keyboard visibility
  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile, { passive: true });

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const handleVV = () => {
      if (!vv) return;
      const h = Math.round(vv.height);
      setVvHeight(h);
      const reduced = (window.innerHeight || h) - h;
      setKbVisible(reduced > 120);
    };
    if (vv) {
      vv.addEventListener("resize", handleVV);
      vv.addEventListener("scroll", handleVV);
      handleVV();
    }
    return () => {
      window.removeEventListener("resize", updateIsMobile as any);
      if (vv) {
        vv.removeEventListener("resize", handleVV);
        vv.removeEventListener("scroll", handleVV);
      }
    };
  }, []);

  const handleRefreshRecommendations = useCallback(() => {
    if (!canShowRecommendations || recs.length === 0 || recSwitching) return;
    setRecSwitching(true);
    window.setTimeout(() => {
      setRecIndex((prev) => (recs.length ? (prev + recommendationWindowSize) % recs.length : 0));
      setSelectedIndex(-1);
      setRecSwitching(false);
    }, 200);
  }, [canShowRecommendations, recs.length, recSwitching, recommendationWindowSize]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    if (isMobile && isHeroInputFocused) setIsSubmitting(true);
    const isBangRedirected = await handleBangRedirect(trimmed);
    if (isBangRedirected) {
      return;
    }

    const params = new URLSearchParams();
    params.set("q", trimmed);

    let targetPath = "/search";

    startTransition(() => {
      setTimeout(() => {
        router.replace(`${targetPath}?${params.toString()}`);
        setTimeout(() => setIsSubmitting(false), 1000);
      }, 100);
    });
  };

  const dropdownActive = (showSuggestions || (isHeroInputFocused && searchQuery.trim().length === 0)) && !isSubmitting;
  const shouldRenderDropdown = dropdownActive && (
    suggestions.length > 0 ||
    (canShowRecommendations && (recLoading || recs.length > 0))
  );
  const keyboardAware = isMobile && (isHeroInputFocused || kbVisible || isSubmitting);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!shouldRenderDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          const selected = suggestions[selectedIndex];
          setSearchQuery(selected.query);
          setShowSuggestions(false);

          if (isMobile && isFocusLocked) {
            unlockingRef.current = true;
            setIsFocusLocked(false);
            setIsHeroInputFocused(false);
            if (pushedStateRef.current) {
              pushedStateRef.current = false;
            }
            setTimeout(() => { unlockingRef.current = false; }, 80);
          }

          router.push(`/search?q=${encodeURIComponent(selected.query)}`);
        } else {
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Set the document title for the homepage
  useEffect(() => {
    document.title = tHome("metaTitle");
  }, [tHome]);

  // Click outside handler for suggestions and input focus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideSuggestions = suggestionsRef.current?.contains(target);
      const clickedInsideInput = searchInputRef.current?.contains(target);
      const clickedInsideForm = heroFormRef.current?.contains(target);

      if (!clickedInsideSuggestions && !clickedInsideInput && !clickedInsideForm) {
        if (showSuggestions) {
          setShowSuggestions(false);
        }
        if (isHeroInputFocused) {
          setIsHeroInputFocused(false);
          try { searchInputRef.current?.blur(); } catch { }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions, isHeroInputFocused]);

  // Global keydown listener to auto-focus search input and capture typing
  useEffect(() => {
    const handleGlobalKeydown = (ev: KeyboardEvent) => {
      if (document.activeElement === searchInputRef.current) return;
      if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'Tab', 'Escape'].includes(ev.key)) {
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      const isAlphanumeric = /^[a-zA-Z0-9]$/.test(ev.key);
      if (!isAlphanumeric) return;

      if ((window.scrollY || 0) > 0) {
        const ua = navigator.userAgent || "";
        const isApple = /iPhone|iPad|iPod|Mac/.test(ua);
        if (!isApple) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }

      try {
        (searchInputRef.current as any)?.focus({ preventScroll: true });
      } catch {
        searchInputRef.current?.focus();
      }

      setSearchQuery(prev => prev + ev.key);
      ev.preventDefault();
    };
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  useEffect(() => {
    if (!isHeroInputFocused || !canShowRecommendations) return;
    if (showSuggestions) return;
    if (!recLoading && recs.length === 0) return;
    setShowSuggestions(true);
  }, [isHeroInputFocused, canShowRecommendations, showSuggestions, recLoading, recs.length]);

  return (
    <main className="h-[100dvh] relative overflow-x-hidden overflow-hidden overscroll-none">
      {/* Top Right Welcome + Profile (only when not scrolled) */}
      <div
        className="fixed top-4 right-4 z-50"
        style={{
          opacity: keyboardAware ? 0 : (1 - scrollProgress),
          transform: `translateY(${-6 * scrollProgress}px) scale(${1 - 0.08 * scrollProgress})`,
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
          pointerEvents: (scrollProgress > 0.4 || keyboardAware) ? "none" : "auto",
        }}
        aria-hidden={scrollProgress > 0.9}
        tabIndex={scrollProgress > 0.9 ? -1 : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            {user && (
              <div className="text-sm text-muted-foreground">
                {tHome("welcomePrefix")} <span className="font-semibold text-foreground">{user.name || tHome("defaultUser")}</span>!
              </div>
            )}
            {(settings.weatherPlacement || 'topRight') === 'topRight' && (
              <div className="text-right">
                <WeatherWidget size="sm" />
              </div>
            )}
          </div>
          <UserProfile showOnlyAvatar={true} avatarSize={48} />
        </div>
      </div>

      <HeroSection
        keyboardAware={keyboardAware}
        vvHeight={vvHeight}
        logoLoaded={logoLoaded}
        selectedLogoState={selectedLogoState}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setShowSuggestions={setShowSuggestions}
        handleKeyDown={handleKeyDown}
        handleSearch={handleSearch}
        isHeroInputFocused={isHeroInputFocused}
        setIsHeroInputFocused={setIsHeroInputFocused}
        isMobile={isMobile}
        isFocusLocked={isFocusLocked}
        setIsFocusLocked={setIsFocusLocked}
        isSubmitting={isSubmitting}
        setSelectedIndex={setSelectedIndex}
        suggestionsRef={suggestionsRef}
        heroFormRef={heroFormRef}
        searchInputRef={searchInputRef}
        unlockingRef={unlockingRef}
        pushedStateRef={pushedStateRef}
        hasBang={hasBang}
      />

      {/* Suggestions Dropdown */}
      {shouldRenderDropdown && (
        <div
          ref={suggestionsRef}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl z-40 overflow-hidden ring-1 ring-black/5 dark:ring-white/10",
            keyboardAware ? "top-[140px]" : "top-[calc(50vh+40px)] sm:top-[calc(50vh+60px)]"
          )}
        >
          {/* Recommendations Header */}
          {canShowRecommendations && (
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MessageCircleMore className="w-3.5 h-3.5" />
                  {tHome("dailyPicks")}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleRefreshRecommendations();
                }}
                disabled={recSwitching}
                className="p-1.5 hover:bg-background/50 rounded-full transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
                title={tHome("refreshPicks")}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", recSwitching && "animate-spin")} />
              </button>
            </div>
          )}

          <div className="max-h-[40vh] overflow-y-auto py-1.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => {
                  setSearchQuery(suggestion.query);
                  setShowSuggestions(false);
                  router.push(`/search?q=${encodeURIComponent(suggestion.query)}`);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors text-sm",
                  index === selectedIndex ? "bg-accent/50 text-accent-foreground" : "hover:bg-accent/30 text-foreground/90",
                  suggestion.type === 'recommendation' && "py-3.5"
                )}
              >
                {suggestion.type === 'recommendation' ? (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4 text-primary" />
                  </div>
                ) : (
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1 truncate font-medium">{suggestion.query}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MainFooter />
    </main>
  );
}