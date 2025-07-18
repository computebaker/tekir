"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Lock, MessageCircleMore, Github, Heart } from "lucide-react";
import UserProfile from "@/components/user-profile";
import Footer from "@/components/footer";
import WeatherWidget from "@/components/weather-widget";

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
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autocompleteSource] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
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
    <main className="min-h-[100vh] relative overflow-x-hidden">
      {/* Profile Picture - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <UserProfile showOnlyAvatar={true} />
      </div>

      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center px-4 relative bg-gradient-to-b from-background via-background to-purple-50/30 dark:to-purple-950/10">
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
              {/* Side glow effects */}
              <div className="absolute inset-0 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none">
                {/* Left glow */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-full bg-gradient-to-r from-blue-500/20 to-transparent rounded-full blur-lg"></div>
                {/* Right glow */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-20 h-full bg-gradient-to-l from-blue-500/20 to-transparent rounded-full blur-lg"></div>
                {/* Top glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-20 bg-gradient-to-b from-blue-500/15 to-transparent rounded-full blur-lg"></div>
                {/* Bottom glow */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-20 bg-gradient-to-t from-blue-500/15 to-transparent rounded-full blur-lg"></div>
              </div>
              
              {/* Search input */}
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
                className="w-full px-6 py-4 pr-24 rounded-full border border-border bg-background shadow-lg focus:outline-none text-lg transition-all duration-300 relative z-10" // Increased pr for two buttons
              />
              
              {/* Search button */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-20">
                <button
                  type="submit"
                  className="p-3 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                  title="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
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
            
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
            
            <WeatherWidget />
            </div>
          
          </div>
      </section>

      {/* Features Section with Bento Grid */}
      <section className="py-20 px-4 bg-gradient-to-br from-purple-50/30 via-pink-50/25 to-blue-50/30 dark:from-purple-950/10 dark:via-pink-950/8 dark:to-blue-950/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              The Search Engine That Respects You
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover why others choose Tekir for their daily searches. 
              Privacy-focused, lightning-fast, and packed with intelligent features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Privacy First - Large Card */}
            <Link href="/privacy" className="lg:col-span-2 block group">
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 p-8 rounded-2xl border border-green-500/30 relative overflow-hidden hover:border-green-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-green-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 via-green-400/15 to-transparent rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-500/30 transition-colors">
                    <Lock className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-green-600 transition-colors">Privacy by Design</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    No tracking, no data collection, no profile building. Your searches remain completely private 
                    and are never stored or shared with third parties.
                  </p>
                </div>
              </div>
            </Link>

            {/* Lightning Fast */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-600/10 p-8 rounded-2xl border border-blue-500/30 relative overflow-hidden hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-400/20 via-blue-400/15 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Lightning Fast</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get results in milliseconds with our optimized search infrastructure. Never stay waiting for answers.
                </p>
              </div>
            </div>

            {/* AI-Powered Chat */}
            <Link href="https://chat.tekir.co" className="block group" target="_blank" rel="noopener noreferrer">
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-600/10 p-8 rounded-2xl border border-purple-500/30 relative overflow-hidden hover:border-purple-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-purple-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-400/20 via-pink-400/15 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                    <MessageCircleMore className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-purple-600 transition-colors">AI-Powered Chat</h3>
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
              <div className="bg-gradient-to-br from-orange-500/10 to-red-600/10 p-8 rounded-2xl border border-orange-500/30 relative overflow-hidden hover:border-orange-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-orange-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-transparent rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-500/30 transition-colors">
                    <div className="text-2xl font-bold text-orange-600">!</div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-orange-600 transition-colors">Bang Commands</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                    Search directly on your favorite sites with bang commands. Type <code className="bg-muted px-2 py-1 rounded">!g</code> for Google, 
                    <code className="bg-muted px-2 py-1 rounded ml-2">!w</code> for Wikipedia, and hundreds more.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-sm">!g Google</span>
                    <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-sm">!w Wikipedia</span>
                    <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-sm">!gh GitHub</span>
                    <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-sm">!yt YouTube</span>
                  </div>
                  <div className="inline-flex items-center text-orange-600 group-hover:text-orange-700 font-medium transition-colors">
                    More bangs →
                  </div>
                </div>
              </div>
            </Link>

            {/* Smart Autocomplete */}
            <Link href="/settings/search" className="block group">
              <div className="bg-gradient-to-br from-teal-500/10 to-cyan-600/10 p-8 rounded-2xl border border-teal-500/30 relative overflow-hidden hover:border-teal-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-teal-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-teal-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-500/30 transition-colors">
                    <Search className="w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-teal-600 transition-colors">Smart Autocomplete</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Intelligent suggestions that learn from global search patterns while keeping your data private.
                  </p>
                </div>
              </div>
            </Link>

            {/* Weather Widget */}
            <Link href="https://clim8.tekir.co" className="block group" target="_blank" rel="noopener noreferrer">
              <div className="bg-gradient-to-br from-sky-500/10 to-blue-600/10 p-8 rounded-2xl border border-sky-500/30 relative overflow-hidden hover:border-sky-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-sky-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-sky-500/30 transition-colors">
                    <div className="w-6 h-6 bg-sky-500 rounded-full relative">
                      <div className="absolute inset-1 bg-yellow-400 rounded-full"></div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-sky-600 transition-colors">Weather at a Glance</h3>
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
                    <Github className="w-6 h-6 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-gray-600 transition-colors">Open Source</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Transparent, auditable code that you can inspect and contribute to.
                  </p>
                </div>
              </div>
            </Link>

            {/* Multiple Providers */}
            <Link href="/settings/search" className="lg:col-span-2 block group">
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 p-8 rounded-2xl border border-indigo-500/30 relative overflow-hidden hover:border-indigo-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-indigo-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/20 to-transparent rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/30 transition-colors">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-indigo-600 transition-colors">Multiple Search Providers</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                    Choose from multiple search engines and sources to get the most comprehensive results. 
                    Switch between providers to find exactly what you're looking for.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-sm">Google</span>
                    <span className="bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-sm">Bing</span>
                    <span className="bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-sm">DuckDuckGo</span>
                    <span className="bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-sm">Brave</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Made for Everyone */}
            <Link href="/about" className="block group">
              <div className="bg-gradient-to-br from-rose-500/10 to-pink-600/10 p-8 rounded-2xl border border-rose-500/30 relative overflow-hidden hover:border-rose-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-rose-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-rose-500/30 transition-colors">
                    <Heart className="w-6 h-6 text-rose-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-rose-600 transition-colors">Made for Everyone</h3>
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
              <Link 
                href="/about" 
                className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-3 rounded-full font-medium hover:from-violet-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Learn More
              </Link>
              <Link 
                href="/settings" 
                className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-3 rounded-full font-medium hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Customize Settings
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer variant="full" />
    </main>
  )};