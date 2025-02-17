"use client";

import Image from "next/image";
import { ChevronDown, Search, Shield, Database, Sparkles, Github, Instagram } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      };
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full px-6 py-4 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
            />
            <button 
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full hover:bg-muted transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>

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