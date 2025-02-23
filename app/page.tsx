"use client";

import Image from "next/image";
import { ChevronDown, Search, Shield, Database, Sparkles, Github, Instagram, Brain, Lock, Code, Server, User, Users, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("karakulakEnabled");
      if (stored == null) {
        localStorage.setItem("karakulakEnabled", "false");
      }
    }
  }, []);

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById("features");
    featuresSection?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (trimmed.includes("!g")) {
        const q = trimmed.replace("!g", "").trim();
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        return;
      } else if (trimmed.includes("!yt")) {
        const q = trimmed.replace("!yt", "").trim();
        window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
        return;
      } else if (trimmed.includes("!d")) {
        const q = trimmed.replace("!d", "").trim();
        window.location.href = `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
        return;
      } else if (trimmed.includes("!w")) {
        const q = trimmed.replace("!w", "").trim();
        window.location.href = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`;
        return;
      } else if (trimmed.includes("!btt")) {
        const q = trimmed.replace("!btt", "").trim();
        window.location.href = `https://btt.community/search?q=${encodeURIComponent(q)}`;
        return;
      } else if (trimmed.includes("!a")) {
        const q = trimmed.replace("!a", "").trim();
        window.location.href = `https://artadosearch.com/search?i=${encodeURIComponent(q)}`;
        return;
      }
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      // Check cache first
      const cacheKey = `autocomplete-${searchQuery.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setSuggestions(JSON.parse(cached));
        return;
      }

      try {
        const response = await fetch('https://autocomplete.tekir.co/brave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: searchQuery }),
        });
        const data = await response.json();
        setSuggestions(data);
        // Cache the results
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <main className="min-h-[200vh] relative">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 relative">
        <div className="w-full max-w-3xl space-y-8 text-center">
          {/* Logo */}
            <div className="flex justify-center">
              <Image src="/tekir.png" alt="Tekir logo" width={200} height={66} />
            </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder="What's on your mind?"
              className="w-full px-6 py-4 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
            />
            <button 
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full hover:bg-muted transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute w-full mt-2 py-2 bg-background rounded-lg border border-border shadow-lg z-50">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.query}
                    onClick={() => {
                      setSearchQuery(suggestion.query);
                      router.push(`/search?q=${encodeURIComponent(suggestion.query)}`);
                      setShowSuggestions(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
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

          {/* Alert Box */}
          <div className="w-full max-w-xl mx-auto px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            DuckDuckGo search is currently down due to technical restrictions.
          </div>

          {/* Scroll Button */}
          <button
            onClick={scrollToFeatures}
            className={`absolute bottom-12 left-1/2 -translate-x-1/2 p-4 rounded-full transition-all duration-300 hover:bg-muted ${
              isScrolled ? "opacity-0" : "opacity-100"
            }`}
          >
            <ChevronDown className="w-6 h-6 animate-bounce" />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-20"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            The capable search engine for the modern web.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Open Source Card */}
            <div className="bg-background p-8 rounded-2xl shadow-lg">
              <Database className="w-10 h-10 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Open Source</h3>
              <p className="text-muted-foreground">
                Fully transparent and community-driven. Our code is open for everyone.
              </p>
            </div>

            {/* No Logs Card */}
            <div className="bg-background p-8 rounded-2xl shadow-lg">
              <Shield className="w-10 h-10 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">No Logs Policy</h3>
              <p className="text-muted-foreground">
                We don't track, store, or collect any of your personal data. Your privacy is our priority.
              </p>
            </div>

            {/* AI Enhanced Card */}
            <div className="bg-background p-8 rounded-2xl shadow-lg">
              <Sparkles className="w-10 h-10 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">AI Enhanced</h3>
              <p className="text-muted-foreground">
                Powered by Gemini 2.0 to deliver more relevant and accurate search results.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="min-h-screen bg-background flex items-center justify-center px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            How Tekir Works
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <Brain className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">AI-Powered Search</h3>
                  <p className="text-muted-foreground">
                    Our Gemini 2.0 integration analyzes queries in real-time to understand context and deliver precise results.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <Lock className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
                  <p className="text-muted-foreground">
                    Zero logs, no tracking, and complete data anonymity ensure your searches remain private.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Server className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Fast & Efficient</h3>
                  <p className="text-muted-foreground">
                    Distributed infrastructure ensures lightning-fast results from multiple sources.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Code className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Open Source</h3>
                  <p className="text-muted-foreground">
                    Tekir is built and maintained by a passionate community of developers who believe in privacy-first technology and open-source principles.
                  </p>
                  </div>
                  </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl bg-muted/30 flex items-center justify-center">
              <Image src="/tekir-down.png" alt="Tekir Illustration" width={300} height={300} className="opacity-100" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            About the Project
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 mx-auto max-w-lg">
              <div className="flex items-center gap-4 mb-8 justify-center">
                <User className="w-12 h-12 text-primary" />
                <h3 className="text-2xl font-semibold">Open Source Community</h3>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Tekir is built and maintained by a passionate community of developers who believe in privacy-first technology and open-source principles.
              </p>

              <p className="text-muted-foreground">
                Our mission is to create a transparent, efficient, and privacy-respecting search engine that serves the modern web without compromising user data.
              </p>

              <div className="flex items-center gap-4 mt-8 justify-center">
                <a
                  href="https://github.com/tekircik"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Github className="w-5 h-5" />
                  <span>Join Us on GitHub</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="aspect-square rounded-2xl bg-background p-8 flex items-center justify-center">
                <Users className="w-20 h-20 text-primary opacity-50" />
              </div>
              <div className="aspect-square rounded-2xl bg-background p-8 flex items-center justify-center">
                <Code className="w-20 h-20 text-primary opacity-50" />
              </div>
              <div className="aspect-square rounded-2xl bg-background p-8 flex items-center justify-center">
                <Lock className="w-20 h-20 text-primary opacity-50" />
              </div>
              <div className="aspect-square rounded-2xl bg-background p-8 flex items-center justify-center">
                <Brain className="w-20 h-20 text-primary opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full py-4 px-6 border-t border-border bg-background">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            🇹🇷 Tekir was made in Turkiye!
          </p>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <a
              href="https://instagram.com/tekirsearch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/tekircik"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}