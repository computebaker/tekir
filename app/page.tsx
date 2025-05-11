"use client";

import Image from "next/image";
import Link from "next/link";
import { CircleAlert, Search, Lock, MessageCircleMore, Sparkles } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { handleBangRedirect } from "@/utils/bangs";
import { useTransition } from "react";

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
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [autocompleteSource] = useState(() => 
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
  const [diveEnabled, setDiveEnabled] = useState(false);
  const [hasBang, setHasBang] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
      // The `dive` page itself will handle the dive logic based on the path,
      // so no explicit `dive=true` param is needed if redirecting to /dive.
    }

    startTransition(() => {
      // Use a timeout to allow visual feedback before navigation
      setTimeout(() => {
        router.replace(`${targetPath}?${params.toString()}`);
      }, 100); 
    });
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      // Check cache first
      const cacheKey = `autocomplete-${autocompleteSource}-${searchQuery.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setSuggestions(JSON.parse(cached));
        return;
      }

      try {
        const response = await fetch(`/api/autocomplete/${autocompleteSource}?q=${encodeURIComponent(searchQuery)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        const data = await response.json();
        
        // Process new response format
        if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
          // Convert the array of strings to array of objects with query property
          const processedSuggestions = data[1].map(suggestion => ({ query: suggestion }));
          setSuggestions(processedSuggestions);
          // Cache the processed results
          sessionStorage.setItem(cacheKey, JSON.stringify(processedSuggestions));
        } else {
          // Fallback for old format or unexpected data
          console.warn('Unexpected suggestion format:', data);
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(timeoutId);
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

  // Ref for click-outside detection
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Add event listeners for online/offline events
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    // Initial check
    handleOnlineStatus();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
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

      {/* Offline Notification */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-500 text-white p-2 text-center flex items-center justify-center">
          <CircleAlert className="w-4 h-4 mr-2" />
          <span>You're offline - only cached results will be available.</span>
        </div>
      )}
        </main>
  );
}
