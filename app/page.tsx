"use client";

import { useEffect, useState, useRef, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Lock, MessageCircleMore, RefreshCw } from "lucide-react";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/components/auth-provider";
import { useSettings } from "@/lib/settings";
import { fetchWithSessionRefreshAndCache } from "@/lib/cache";
import WeatherWidget from "@/components/weather-widget";
import { SearchInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MainFooter from "@/components/main-footer";
import { cn } from "@/lib/utils";

async function fetchWithSessionRefresh(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const originalResponse = await fetch(url, options);

  if (originalResponse.status === 401 || originalResponse.status === 403 && originalResponse.headers.get("Content-Type")?.includes("application/json")) {
    const responseCloneForErrorCheck = originalResponse.clone();
    try {
      const errorData = await responseCloneForErrorCheck.json();
      if (errorData && errorData.error === "Invalid or expired session token.") {
        console.log("Session token expired or invalid. Attempting to refresh session...");
        const registerResponse = await fetch("/api/session/register", { method: "POST" });
        if (registerResponse.ok) {
          console.log("Session refreshed successfully. Retrying the original request.");
          return await fetch(url, options);
        } else {
          console.error("Failed to refresh session. Status:", registerResponse.status);
          return originalResponse;
        }
      }
    } catch (e) {
      console.warn("Error parsing JSON from 403/401 response, or not the specific session token error:", e);
    }
  }
  return originalResponse;
}

interface Suggestion {
  query: string;
  type?: 'autocomplete' | 'recommendation';
}

export default function Home() {
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autocompleteSource] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
  const hasBang = useMemo(() => /(?:^|\s)![a-z]+/.test(searchQuery.toLowerCase()), [searchQuery]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const heroFormRef = useRef<HTMLFormElement>(null);
  const [recs, setRecs] = useState<string[]>([]);
  const [recIndex, setRecIndex] = useState(0);
  const [recLoading, setRecLoading] = useState(false);
  const [recSwitching, setRecSwitching] = useState(false);
  const recommendationWindowSize = 5;
  // Lock raised state while submitting so it doesn't animate back before redirect
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Focus lock on mobile: keep input focused until back/outside tap
  const [isFocusLocked, setIsFocusLocked] = useState(false);
  const unlockingRef = useRef(false);
  const pushedStateRef = useRef(false);
  // Tri-state: null = unknown (no explicit local value) | true | false
  // If user has an explicit local preference in localStorage, use it immediately.
  // Otherwise keep null and wait for server settings (isInitialized) before rendering.
  const [localShowRecs, setLocalShowRecs] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('showRecommendations');
      if (stored === null) return null;
      return stored === 'true';
    }
    return null;
  });
  const showHeroWeather = (settings.clim8Enabled ?? true) && ((settings.weatherPlacement || 'topRight') === 'hero');

  // Determine effective preference: true/false when known, null when still unresolved
  const effectiveShowRecs: boolean | null = localShowRecs !== null ? localShowRecs : (isInitialized ? (settings.showRecommendations ?? false) : null);


  // Placeholder for handleBangRedirect if it's not globally available or imported
  const handleBangRedirect = async (query: string): Promise<boolean> => {
    // This is a placeholder. Actual implementation might involve API calls.
    // If it makes fetch calls, they should also use fetchWithSessionRefresh.
    console.log(`Placeholder: handleBangRedirect for "${query}"`);
    if (query.startsWith("!g ")) {
      window.location.href = `https://google.com/search?q=${encodeURIComponent(query.substring(3))}`;
      return true;
    }
    return false;
  };
  
  // Helper function to detect if input contains a bang
  const checkForBang = (input: string): boolean => {
    // Check for bang pattern (! followed by letters)
    return /(?:^|\s)![a-z]+/.test(input.toLowerCase());
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
        // If there was no local explicit value, persist server value locally for next loads
        if (localStorage.getItem('showRecommendations') === null) {
          localStorage.setItem('showRecommendations', String(serverValue));
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isInitialized, settings.showRecommendations]);

  // Fetch daily recommendations in background on page load
  useEffect(() => {
    let active = true;
    const run = async () => {
      setRecLoading(true);
      try {
        const res = await fetchWithSessionRefreshAndCache<{ results: string[]; date?: string; dateLabel?: string }>(
          "/api/recommend",
          { method: "GET", headers: { "Content-Type": "application/json" } },
          { searchType: "ai", provider: "recommend", query: "today" }
        );
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.results) ? data.results.filter((s: any) => typeof s === "string" && s.trim()) : [];
          if (items.length > 0) {
            setRecs(items);
            setRecIndex(0);
            console.log(`[Recommendations] Loaded ${items.length} recommendations:`, items);
          } else {
            setRecs([]);
            console.log('[Recommendations] No recommendations returned from API');
          }
        } else {
          console.warn(`[Recommendations] API returned error status: ${res.status}`);
        }
      } catch (e) {
        console.warn("[Recommendations] Failed to load recommendations", e);
      } finally {
        if (active) setRecLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []); // Only run once on mount

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
        try { searchInputRef.current?.blur(); } catch {}
        window.setTimeout(() => { unlockingRef.current = false; }, 80);
  pushedStateRef.current = false;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isMobile, isFocusLocked]);

  useEffect(() => {
    const handler = (ev: Event) => {
      if (!isMobile || !isFocusLocked) return;
      const target = ev.target as Node | null;
      const insideSuggestions = suggestionsRef.current?.contains(target as Node) ?? false;
      const insideForm = heroFormRef.current?.contains(target as Node) ?? false;
      if (!insideForm && !insideSuggestions) {
        unlockingRef.current = true;
        setIsFocusLocked(false);
        setIsHeroInputFocused(false);
        try { searchInputRef.current?.blur(); } catch {}
        if (pushedStateRef.current) {
          try { history.back(); } catch {}
          pushedStateRef.current = false;
        }
        window.setTimeout(() => { unlockingRef.current = false; }, 80);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler as any);
      document.removeEventListener('mousedown', handler as any);
    };
  }, [isMobile, isFocusLocked]);

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
      // Heuristic: if the visual viewport is notably shorter than the layout viewport, keyboard is likely visible
      const reduced = (window.innerHeight || h) - h;
      setKbVisible(reduced > 120); // ~ keyboard height threshold in px
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

  const isBlankQuery = searchQuery.trim().length === 0;
  const canShowRecommendations = effectiveShowRecs === true && isBlankQuery;
  const recommendationSuggestions = useMemo(() => {
    if (!canShowRecommendations || recs.length === 0) return [] as Suggestion[];
    const size = Math.min(recommendationWindowSize, recs.length);
    const items: Suggestion[] = [];
    for (let i = 0; i < size; i++) {
      const query = recs[(recIndex + i) % recs.length];
      items.push({ query, type: "recommendation" });
    }
    return items;
  }, [canShowRecommendations, recs, recIndex, recommendationWindowSize]);
  const visibleSuggestions = canShowRecommendations ? recommendationSuggestions : suggestions;

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

    // It's generally better to handle bang redirects before deciding the target path,
    // as a bang might take the user to a completely different site.
    if (isMobile && isHeroInputFocused) setIsSubmitting(true);
    const isBangRedirected = await handleBangRedirect(trimmed);
    if (isBangRedirected) {
      return; // If redirected by a bang, no further action is needed here.
    }

    const params = new URLSearchParams();
    params.set("q", trimmed);

    let targetPath = "/search";

    startTransition(() => {
      // Use a timeout to allow visual feedback before navigation
      setTimeout(() => {
        router.replace(`${targetPath}?${params.toString()}`);
  // safety: in case navigation is delayed/cancelled by browser, release lock after a bit
  setTimeout(() => setIsSubmitting(false), 1000);
      }, 100); 
    });
  };

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts or effect re-runs

    const fetchSuggestions = async () => {
      if (!isMounted) return;

      // When search is empty and recommendations are enabled, show recommendations immediately
  if (isBlankQuery) {
        if (effectiveShowRecs === true && recs.length > 0) {
          const recSuggestions = recs.map(rec => ({ query: rec, type: 'recommendation' as const }));
          console.log(`[Suggestions] Showing ${recSuggestions.length} recommendations`, recSuggestions);
          if (isMounted) setSuggestions(recSuggestions);
        } else {
          console.log(`[Suggestions] Not showing recommendations - effectiveShowRecs: ${effectiveShowRecs}, recs.length: ${recs.length}`);
          if (isMounted) setSuggestions([]);
        }
        return;
      }

  if (!isBlankQuery && searchQuery.trim().length < 2) {
        if (isMounted) setSuggestions([]);
        return;
      }

  // Include user settings in cache key and in the request so suggestions
  // are scoped to country/lang/safesearch. Use query-string style so keys
  // match: autocomplete-brave-pornhub?country=ALL&lang=en&safesearch=off
  const country = (typeof window !== 'undefined' && localStorage.getItem('searchCountry')) || 'ALL';
  const safesearch = (typeof window !== 'undefined' && localStorage.getItem('safesearch')) || 'moderate';
  const lang = (typeof window !== 'undefined' && (localStorage.getItem('language') || navigator.language?.slice(0,2))) || '';
  const baseKey = `autocomplete-${autocompleteSource}-${searchQuery.trim().toLowerCase()}`;
  const _paramsForKey = new URLSearchParams();
  _paramsForKey.set('country', country);
  if (lang) _paramsForKey.set('lang', lang);
  _paramsForKey.set('safesearch', safesearch);
  const cacheKey = `${baseKey}?${_paramsForKey.toString()}`;
  const cached = sessionStorage.getItem(cacheKey);
      if (!(window as any).__autocompleteRetryMap) (window as any).__autocompleteRetryMap = {};
      const retryMap: Record<string, boolean> = (window as any).__autocompleteRetryMap;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isMounted) setSuggestions(parsed);
            return;
          }
          if (Array.isArray(parsed) && parsed.length === 0 && retryMap[cacheKey]) {
            if (isMounted) setSuggestions([]);
            return;
          }
        } catch (e) {
          // fall through to fetch
        }
      }

      try {
  const params = new URLSearchParams();
  params.set('q', searchQuery);
  params.set('country', country);
  if (lang) params.set('lang', lang);
  params.set('safesearch', safesearch);
  const url = `/api/autocomplete/${autocompleteSource}?${params.toString()}`;
  const response = await fetchWithSessionRefresh(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`Autocomplete fetch failed with status ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
          const processedSuggestions = data[1].slice(0, 5).map(suggestion => ({ query: suggestion, type: 'autocomplete' as const }));
          if (isMounted) setSuggestions(processedSuggestions);
          sessionStorage.setItem(cacheKey, JSON.stringify(processedSuggestions));
          // clear any retry mark
          if (retryMap[cacheKey]) delete retryMap[cacheKey];
        } else {
          console.warn('Unexpected suggestion format:', data);
          if (isMounted) setSuggestions([]);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        if (isMounted) setSuggestions([]);
      }
    };

  // Show recommendations immediately when search is empty, debounce autocomplete
  const delay = isBlankQuery ? 0 : 200;
    const timeoutId = setTimeout(fetchSuggestions, delay);
    
    return () => {
      isMounted = false; // Set to false on cleanup
      clearTimeout(timeoutId);
    };
  }, [searchQuery, autocompleteSource, effectiveShowRecs, recs, isBlankQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!shouldRenderDropdown || visibleSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < visibleSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          const selected = visibleSuggestions[selectedIndex];
          setSearchQuery(selected.query);
          router.push(`/search?q=${encodeURIComponent(selected.query)}`);
          setShowSuggestions(false);
        } else {
          // Even if no suggestion is selected, hide the dropdown on Enter
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
    document.title = "Tekir - The capable search engine";
  }, []);

  // Click outside handler for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideSuggestions = suggestionsRef.current?.contains(target);
      const clickedInsideInput = searchInputRef.current?.contains(target);
      const clickedInsideForm = heroFormRef.current?.contains(target);
      
      if (!clickedInsideSuggestions && !clickedInsideInput && !clickedInsideForm && showSuggestions) {
        setShowSuggestions(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  // Global keydown listener to auto-focus search input and capture typing
  useEffect(() => {
    const handleGlobalKeydown = (ev: KeyboardEvent) => {
      if (document.activeElement !== searchInputRef.current) {
        // If user starts typing while scrolled, jump to top to expose the main search UI
        const isTypingKey = ev.key === "Backspace" || (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey);
        if ((window.scrollY || 0) > 0 && isTypingKey) {
          const ua = navigator.userAgent || "";
          const isApple = /iPhone|iPad|iPod|Mac/.test(ua);
          if (!isApple) {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }
        try {
          // Prevent browsers (notably Safari) from auto-scrolling too far when focusing
          (searchInputRef.current as any)?.focus({ preventScroll: true });
        } catch {
          searchInputRef.current?.focus();
        }
        if (ev.key === "Backspace") {
          setSearchQuery(prev => prev.slice(0, -1));
        } else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          setSearchQuery(prev => prev + ev.key);
        }
        ev.preventDefault();
      }
    };
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  const dropdownActive = (showSuggestions || (isHeroInputFocused && isBlankQuery)) && !isSubmitting;
  const shouldRenderDropdown = dropdownActive && (
    visibleSuggestions.length > 0 ||
    (canShowRecommendations && (recLoading || recs.length > 0))
  );
  const keyboardAware = isMobile && (isHeroInputFocused || kbVisible || isSubmitting);

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
                Welcome, <span className="font-semibold text-foreground">{user.name || "User"}!</span>
              </div>
            )}
            {/* Weather below welcome (only if placement is topRight) */}
            {(settings.weatherPlacement || 'topRight') === 'topRight' && (
              <div className="text-right">
                <WeatherWidget size="sm" />
              </div>
            )}
          </div>
          <UserProfile showOnlyAvatar={true} avatarSize={48} />
        </div>
      </div>



      {/* Hero Section */}
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
            <div 
              onMouseEnter={() => setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
              className="cursor-pointer"
            >
              <Image 
                src={isLogoHovered ? "/head-animated.gif" : "/tekir-outlined.png"} 
                alt="Tekir logo" 
                width={200} 
                height={66} 
                loading="eager" 
                priority 
              />
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
              try { history.pushState({ focusLock: true }, "", location.href); pushedStateRef.current = true; } catch {}
            }
            window.setTimeout(() => {
              try {
                const ua = navigator.userAgent || "";
                const isApple = /iPhone|iPad|iPod|Mac/.test(ua);
                if (!isApple) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              } catch {}
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
                placeholder="What's on your mind?"
                className="w-full pr-24 shadow-lg transition-all duration-300 relative z-10"
              />
              
              {/* Search button */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-20">
                <Button type="submit" variant="ghost" size="icon" shape="pill" title="Search">
                  <Search className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            {/* Static links row under the search bar (when recommendations disabled or search not focused) */}
            {!isHeroInputFocused && effectiveShowRecs !== true && (
              <div className="absolute w-full mt-2 px-2 text-[15px] sm:text-base md:text-lg text-muted-foreground/90 font-medium">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-3 mt-1 text-muted-foreground mx-auto flex-wrap">
                    <Link href="/about" className="hover:text-foreground transition-colors">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span className="font-medium">Your searches, private.</span>
                      </div>
                    </Link>
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
                    <Link href="https://chat.tekir.co" className="hover:text-foreground transition-colors">
                      <div className="flex items-center gap-2">
                        <MessageCircleMore className="w-4 h-4" />
                        <span className="font-medium">AI Chat</span>
                      </div>
                    </Link>
                    {showHeroWeather && (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
                        <WeatherWidget size="link" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Autocomplete dropdown with recommendations */}
            {shouldRenderDropdown && (
              <div 
                ref={suggestionsRef}
                className="absolute w-full mt-2 py-2 bg-background rounded-lg border border-border shadow-lg z-50"
              >
                {canShowRecommendations && (
                  <>
                    <div className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80 text-left">
                      Recommendations
                    </div>
                    {recLoading && recommendationSuggestions.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground/70 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span>Fetching today&apos;s picks…</span>
                      </div>
                    )}
                  </>
                )}
                {visibleSuggestions.map((suggestion: Suggestion, index: number) => {
                  const isRecommendation = suggestion.type === 'recommendation';
                  return (
                    <button
                      key={`${suggestion.type}-${suggestion.query}`}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        setSearchQuery(suggestion.query);
                        router.push(`/search?q=${encodeURIComponent(suggestion.query)}`);
                        setShowSuggestions(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors ${
                        index === selectedIndex ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isRecommendation ? (
                          <>
                            <Search className="w-4 h-4 text-primary" />
                            <span className="text-sm text-foreground/90 font-normal">{suggestion.query}</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <span>{suggestion.query}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
                {canShowRecommendations && recommendationSuggestions.length > 0 && recs.length > recommendationWindowSize && (
                  <div className="px-4 pt-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        handleRefreshRecommendations();
                      }}
                      disabled={recSwitching}
                    >
                      {recSwitching ? "Refreshing…" : "Refresh recommendations"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </form>          
          </div>
      </section>
      {/* Fixed on-screen footer */}
      <MainFooter hidden={keyboardAware} />
    </main>
  )};