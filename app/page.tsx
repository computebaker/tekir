"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Lock, MessageCircleMore, Github, Heart, RefreshCw } from "lucide-react";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/components/auth-provider";
import { useSettings } from "@/lib/settings";
import Footer from "@/components/footer";
import { fetchWithSessionRefreshAndCache } from "@/lib/cache";
import WeatherWidget from "@/components/weather-widget";
import { Input, SearchInput } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { BadgeChip } from "@/components/shared/badge-chip";
import { SectionHeading } from "@/components/shared/section-heading";

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
}

export default function Home() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
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
  const [hasBang, setHasBang] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [recs, setRecs] = useState<string[]>([]);
  const [recIndex, setRecIndex] = useState(0);
  const [recLoading, setRecLoading] = useState(false);
  const [recDateLabel, setRecDateLabel] = useState<string | undefined>(undefined);
  const [recSwitching, setRecSwitching] = useState(false);


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
  
  // Update bang detection when search input changes
  useEffect(() => {
    setHasBang(checkForBang(searchQuery));
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("karakulakEnabled");
      if (stored == null) {
        localStorage.setItem("karakulakEnabled", "true");
      }
    }
  }, []);

  // Fetch daily recommendations once
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
            setRecIndex(Math.floor(Math.random() * items.length));
            setRecDateLabel(data?.dateLabel);
          } else {
            setRecs([]);
          }
        }
      } catch (e) {
        console.warn("Failed to load recommendations", e);
      } finally {
        if (active) setRecLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // It's generally better to handle bang redirects before deciding the target path,
    // as a bang might take the user to a completely different site.
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
      }, 100); 
    });
  };

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts or effect re-runs

    const fetchSuggestions = async () => {
      if (!isMounted) return;

      if (searchQuery.trim().length < 2) {
        if (isMounted) setSuggestions([]);
        return;
      }

      const cacheKey = `autocomplete-${autocompleteSource}-${searchQuery.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        if (isMounted) setSuggestions(JSON.parse(cached));
        return;
      }

      try {
        const response = await fetchWithSessionRefresh(`/api/autocomplete/${autocompleteSource}?q=${encodeURIComponent(searchQuery)}`, {
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
          const processedSuggestions = data[1].map(suggestion => ({ query: suggestion }));
          if (isMounted) setSuggestions(processedSuggestions);
          sessionStorage.setItem(cacheKey, JSON.stringify(processedSuggestions));
        } else {
          console.warn('Unexpected suggestion format:', data);
          if (isMounted) setSuggestions([]);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        if (isMounted) setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 200);
    
    return () => {
      isMounted = false; // Set to false on cleanup
      clearTimeout(timeoutId);
    };
  }, [searchQuery, autocompleteSource]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

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
      if (suggestionsRef.current && 
          !suggestionsRef.current.contains(event.target as Node) && 
          showSuggestions) {
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
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        searchInputRef.current?.focus();
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

  return (
    <main className="min-h-[100vh] relative overflow-x-hidden">
      {/* Top Right Welcome + Profile (only when not scrolled) */}
  <div
        className="fixed top-4 right-4 z-50"
        style={{
          opacity: 1 - scrollProgress,
          transform: `translateY(${-6 * scrollProgress}px) scale(${1 - 0.08 * scrollProgress})`,
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
          pointerEvents: scrollProgress > 0.4 ? "none" : "auto",
        }}
        aria-hidden={scrollProgress > 0.9}
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

      {/* Blurred Navbar on Scroll */}
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/70"
        style={{
          opacity: scrollProgress,
          transform: `translateY(${(-8) * (1 - scrollProgress)}px)`,
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
          pointerEvents: scrollProgress > 0.1 ? "auto" : "none",
        }}
        aria-hidden={scrollProgress < 0.05}
      >
          <div className="container mx-auto flex items-center gap-4 h-14 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image src="/tekir-head.png" alt="Tekir" width={36} height={12} priority style={{ transform: `scale(${0.95 + 0.05 * scrollProgress})`, transition: "transform 150ms ease-out" }} />
              <span className="sr-only">Tekir</span>
            </Link>
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <SearchInput
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(false);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(false)}
                  placeholder="Search..."
                  className="w-full pr-12 h-10"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Button type="submit" variant="ghost" size="icon" shape="pill" title="Search">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </form>
            <div className="flex items-center gap-3 ml-auto">
              {user && (
                <div className="hidden sm:block text-sm text-muted-foreground">
                  Welcome, <span className="font-semibold text-foreground">{user.name || "User"}!</span>
                </div>
              )}
              <div style={{ transform: `scale(${0.92 + 0.08 * scrollProgress})`, transition: "transform 150ms ease-out" }}>
                <UserProfile showOnlyAvatar={true} avatarSize={40} />
              </div>
            </div>
          </div>
      </header>

      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center px-4 relative bg-gradient-to-b from-background via-background to-gray-50/30 dark:to-gray-950/10">
        <div className="w-full max-w-3xl space-y-8 text-center">
          {/* Logo */}
          <div className="flex justify-center">
            <div 
              onMouseEnter={() => setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
              className="cursor-pointer"
            >
              <Image 
                src={isLogoHovered ? "/head-animated.gif" : "/tekir-head.png"} 
                alt="Tekir logo" 
                width={200} 
                height={66} 
                loading="eager" 
                priority 
              />
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative w-full">
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
                onFocus={() => setShowSuggestions(true)}
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
            
            {/* Recommendations row under the search bar (toggleable) */}
            <div className="absolute w-full mt-3 px-2 text-[15px] sm:text-base md:text-lg text-muted-foreground/90 font-medium">
              {(settings.showRecommendations ?? true)
                ? (
                  recs.length > 0
                    ? (
                      <div className="flex items-center justify-center">
                        <div className="relative inline-flex items-center gap-1 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-border/50 bg-background/60 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/40 overflow-hidden max-w-[92%] sm:max-w-none whitespace-nowrap">
                          {recSwitching && (
                            <>
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 rounded-full bg-muted/70 dark:bg-muted/50 border border-border/50 animate-pulse pointer-events-none"
                              />
                              <div aria-hidden="true" className="shimmer-soft" />
                            </>
                          )}
                          <span className="text-muted-foreground/80">Try:</span>
                          <button
                            type="button"
                            className={`hover:text-foreground transition-colors underline-offset-4 hover:underline font-semibold text-foreground ${recSwitching ? "animate-pulse cursor-wait" : ""} truncate max-w-[60vw] sm:max-w-none`}
                            onClick={() => {
                              const q = recs[recIndex];
                              router.push(`/search?q=${encodeURIComponent(q)}`);
                            }}
                            title={recDateLabel ? `Daily pick — ${recDateLabel}` : "Daily pick"}
                            aria-label={recDateLabel ? `You can search: ${recs[recIndex]} — ${recDateLabel}` : `You can search: ${recs[recIndex]}`}
                            aria-busy={recSwitching}
                            disabled={recSwitching}
                          >
                            {recs[recIndex]}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            shape="pill"
                            title="Show another"
                            onClick={() => {
                              if (!recs.length || recSwitching) return;
                              setRecSwitching(true);
                              window.setTimeout(() => {
                                setRecIndex((i) => (recs.length ? (i + 1) % recs.length : 0));
                                setRecSwitching(false);
                              }, 600);
                            }}
                            className="h-5 w-5 sm:h-6 sm:w-6 opacity-80 hover:opacity-100 ml-0.5 sm:ml-1"
                            disabled={recSwitching}
                          >
                            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${recLoading || recSwitching ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </div>
                    )
                    : (
                      hasBang ? (
                        <div className="text-center">
                          <a href="https://bang.lat"> Bangs by bang.lat — the fastest bang resolver. </a>
                        </div>
                      ) : null
                    )
                )
                : (
                  // Old links row (restored when recommendations are disabled)
                  <div className="flex items-center justify-center gap-3 mt-4 text-muted-foreground mx-auto flex-wrap">
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
                  </div>
        )}
      </div>
            
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute w-full mt-2 py-2 bg-background rounded-lg border border-border shadow-lg z-50"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.query}
                    onClick={() => {
                      setSearchQuery(suggestion.query);
                      router.push(`/search?q=${encodeURIComponent(suggestion.query)}`);
                      setShowSuggestions(false);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors ${
                      index === selectedIndex ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <span>{suggestion.query}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </form>
          
            {/* Removed the old link row under the search bar and replaced with recommendations above */}
          
          </div>
      </section>

      {/* Features Section with Bento Grid */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-50/30 via-slate-50/25 to-neutral-50/30 dark:from-gray-950/10 dark:via-slate-950/8 dark:to-neutral-950/10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading 
            title="The Search Engine That Respects You"
            subtitle={<>
              Discover why others choose Tekir for their daily searches. <br className="hidden sm:block" />
              Privacy-focused, lightning-fast, and packed with intelligent features.
            </>}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Privacy First - Large Card */}
            <Link href="/privacy" className="lg:col-span-2 block group">
              <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/20 via-slate-400/15 to-transparent rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gray-500/30 transition-colors">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-muted-foreground transition-colors">Privacy by Design</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    No tracking, no data collection, no profile building. Your searches remain completely private 
                    and are never stored or shared with third parties.
                  </p>
                </div>
              </div>
            </Link>

            {/* Lightning Fast */}
            <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:shadow-xl hover:shadow-slate-500/20 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-400/20 via-gray-400/15 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-muted-foreground rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Lightning Fast</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get results in milliseconds with our optimized search infrastructure. Never stay waiting for answers.
                </p>
              </div>
            </div>

            {/* AI-Powered Chat */}
            <Link href="https://chat.tekir.co" className="block group" target="_blank" rel="noopener noreferrer">
              <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-400/20 via-slate-400/15 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-500/30 transition-colors">
                    <MessageCircleMore className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">AI-Powered Chat</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Get instant answers with our integrated AI chat powered by advanced language models.
                  </p>
                  <br />
                  <p className="text-muted-foreground leading-relaxed">
                    Experience seamless conversations and get the information you need, when you need it. Use our AI chat to dive deeper into topics and ask follow-up questions.
                  </p>
                </div>
              </div>
            </Link>

            {/* Bang Commands - Large Card */}
            <Link href="/bangs" className="lg:col-span-2 block group">
              <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:border-slate-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-slate-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-400/20 to-transparent rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-slate-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-500/30 transition-colors">
                    <div className="text-2xl font-bold text-muted-foreground">!</div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-muted-foreground transition-colors">Bang Commands</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                    Search directly on your favorite sites with bang commands. Type <code className="bg-muted px-2 py-1 rounded">!g</code> for Google, 
                    <code className="bg-muted px-2 py-1 rounded ml-2">!w</code> for Wikipedia, and hundreds more.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <BadgeChip color="slate">!g Google</BadgeChip>
                    <BadgeChip color="slate">!w Wikipedia</BadgeChip>
                    <BadgeChip color="slate">!gh GitHub</BadgeChip>
                    <BadgeChip color="slate">!yt YouTube</BadgeChip>
                  </div>
                  <div className="inline-flex items-center text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                    More bangs →
                  </div>
                </div>
              </div>
            </Link>

            {/* Smart Autocomplete */}
            <Link href="/settings/search" className="block group">
              <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-500/30 transition-colors">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Smart Autocomplete</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Intelligent suggestions that learn from global search patterns while keeping your data private.
                  </p>
                </div>
              </div>
            </Link>

            {/* Weather Widget */}
            <Link href="https://clim8.tekir.co" className="block group" target="_blank" rel="noopener noreferrer">
              <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:border-slate-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-slate-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-500/30 transition-colors">
                    <div className="w-6 h-6 bg-muted-foreground rounded-full relative">
                      <div className="absolute inset-1 bg-yellow-400 rounded-full"></div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Weather at a Glance</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Get current weather conditions right on your search homepage.
                  </p>
                </div>
              </div>
            </Link>

            {/* Open Source */}
            <Link href="https://github.com/computebaker/tekir" className="block group" target="_blank" rel="noopener noreferrer">
              <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-500/30 transition-colors">
                    <Github className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Open Source</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Transparent, auditable code that you can inspect and contribute to.
                  </p>
                </div>
              </div>
            </Link>

            {/* Multiple Providers */}
            <Link href="/settings/search" className="lg:col-span-2 block group">
              <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/20 to-transparent rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gray-500/30 transition-colors">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                      <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                      <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                      <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-muted-foreground transition-colors">Multiple Search Providers</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                    Choose from multiple search engines and sources to get the most comprehensive results. 
                    Switch between providers to find exactly what you&apos;re looking for.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <BadgeChip color="gray">Google</BadgeChip>
                    <BadgeChip color="gray">Bing</BadgeChip>
                    <BadgeChip color="gray">DuckDuckGo</BadgeChip>
                    <BadgeChip color="gray">Brave</BadgeChip>
                  </div>
                </div>
              </div>
            </Link>

            {/* Made for Everyone */}
            <Link href="/about" className="block group">
              <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:border-slate-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-slate-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-500/30 transition-colors">
                    <Heart className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Made for Everyone</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Accessible, inclusive, and designed to work for all users regardless of their background or abilities. Does not discriminate based on location, language, or device. Made for all, by all.
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* CTA Section */}
          <div className="text-center mt-16">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Ready to experience better search?
            </h3>
            <p className="text-muted-foreground mb-8">
              Start searching with Tekir today and discover the difference privacy makes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/about" className={buttonVariants({ variant: "default", size: "lg" }) + " rounded-full px-8"}>
                Learn More
              </Link>
              <Link href="/settings" className={buttonVariants({ variant: "secondary", size: "lg" }) + " rounded-full px-8"}>
                Customize Settings
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer variant="full" />
    </main>
  )};