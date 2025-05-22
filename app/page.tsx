"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Sparkles, Lock, MessageCircleMore } from "lucide-react";

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
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autocompleteSource] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
  const [diveEnabled, setDiveEnabled] = useState(false);
  const [hasBang, setHasBang] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);


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

  const handleToggleDiveSearch = () => {
    setDiveEnabled(prevDiveEnabled => !prevDiveEnabled);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
    if (diveEnabled) {
      targetPath = "/dive";
    }

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
    <main className="min-h-[100vh] relative">
      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center px-4 relative">
        <div className="w-full max-w-3xl space-y-8 text-center">
          {/* Logo */}
          <div className="flex justify-center">
            <Image src="/tekir-head.png" alt="Tekir logo" width={200} height={66} loading="eager" priority />
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative w-full">
            <input
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
              className="w-full px-6 py-4 pr-24 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg" // Increased pr for two buttons
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"> {/* Container for buttons */}
              <button
                type="button"
                onClick={handleToggleDiveSearch}
                className={`p-3 rounded-full transition-colors mr-1 ${diveEnabled ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                title="Toggle Dive Search"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button
                type="submit"
                className="p-3 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                title="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            
            {/* Bang notification */}
            {hasBang && (
              <div className="absolute w-full text-center mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                <a href="https://bang.lat"> Bangs by bang.lat — the fastest bang resolver. </a>
              </div>
            )}

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
          
            <div className="flex items-center justify-center gap-3 mt-4 text-muted-foreground mx-auto">
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
          
          </div>
      </section>

      <footer className="bg-neutral-900 text-neutral-300 w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-10 mb-10">
            {/* Column 1: Logo, Tagline, Discover Button */}
            <div className="lg:col-span-4">
              <div className="mb-5">
                <Image src="/tekir.png" alt="Tekir Logo" width={50} height={150} />
              </div>
              <p className="text-neutral-400 mb-6 text-sm leading-relaxed">
                Tekir is a privacy-friendly search engine that serves the best search experience. 
              </p>
              <Link
                href="/about"
                className="inline-block px-5 py-2 border border-neutral-600 rounded-md text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:border-neutral-500 transition-colors"
              >
                Discover the service
              </Link>
            </div>

            <div className="lg:col-span-2 lg:col-start-6 md:col-start-auto">
              <h3 className="text-base font-semibold text-neutral-100 mb-4">Products</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="text-neutral-400 hover:text-white transition-colors">Search</Link></li>
                <li><Link href="/dive" className="text-neutral-400 hover:text-white transition-colors">Dive Mode</Link></li>
                <li><Link href="/chat" className="text-neutral-400 hover:text-white transition-colors">AI Chat</Link></li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-base font-semibold text-neutral-100 mb-4">About Tekir</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="/about" className="text-neutral-400 hover:text-white transition-colors">About us</a></li>
                <li><a href="/privacy" className="text-neutral-400 hover:text-white transition-colors">Privacy</a></li>
                <li><a href="/terms" className="text-neutral-400 hover:text-white transition-colors">Terms</a></li>
                <li><a href="https://computebaker.com" className="text-neutral-400 hover:text-white transition-colors">computebaker</a></li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-base font-semibold text-neutral-100 mb-4">Follow us</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="https://instagram.com/tekirsearch" className="text-neutral-400 hover:text-white transition-colors">Instagram</Link></li>
                <li><Link href="https://bsky.app/profile/tekir.co" className="text-neutral-400 hover:text-white transition-colors">Bluesky</Link></li>
            </ul>
            </div>
          </div>

          <hr className="border-neutral-800" />

          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-neutral-500 pt-8 gap-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-2">
              <span>&copy; {new Date().getFullYear()} <Link href="https://computebaker.com">computebaker</Link>. All rights reserved.</span>
              <Link href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-neutral-300 transition-colors">Terms of Service</Link>
            </div>
            <Link
              href="https://btt.community/t/tekir-meta-arama-motoru/18108"
              className="mt-4 md:mt-0 shrink-0 px-5 py-2 border border-neutral-700 rounded-md text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 transition-colors"
            >
              Share your feedback
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )};