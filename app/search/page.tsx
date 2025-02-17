"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, Cat, Instagram, Github, Info } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { set } from "date-fns";

interface SearchResult {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  source: string;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Default aiEnabled set to true.
  const [aiEnabled, setAiEnabled] = useState(true);
  const [searchEngine, setSearchEngine] = useState("brave");

  // Read the AI preference from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem("karakulakEnabled");
    if (stored !== null) {
      setAiEnabled(stored === "true");
    }
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) return;
      
      // Check for cached data in sessionStorage
      const cached = sessionStorage.getItem(`search-${searchEngine}-${query}`);
      if (cached) {
        const { results: cachedResults, aiResponse: cachedAi } = JSON.parse(cached);
        setResults(cachedResults);
        setAiResponse(cachedAi);
        return;
      }
      
      setLoading(true);
      if (aiEnabled) setAiLoading(true);
      else setAiResponse(null);

      let searchData: SearchResult[] = [];
      // Fetch regular search results.
      try {
        const response = await fetch(
          `https://searchapi.tekir.co/api?q=${encodeURIComponent(query)}&source=${searchEngine}`
        );
        searchData = await response.json();
        setResults(searchData);
        // Cache search results without AI response first.
        sessionStorage.setItem(`search-${searchEngine}-${query}`, JSON.stringify({ results: searchData, aiResponse: null }));
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }

      // Fetch AI response only if enabled.
      if (aiEnabled) {
        try {
          const aiRes = await fetch("https://searchai.tekir.co/gemini", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: query.replace(/%20/g, " "),
            }),
          });
          const aiData = await aiRes.json();
          const aiResult = aiData.result.trim();
          setAiResponse(aiResult);
          // Update cache with the AI response.
          sessionStorage.setItem(`search-${query}`, JSON.stringify({ results: searchData, aiResponse: aiResult }));
        } catch (error) {
          console.error("AI response failed:", error);
        } finally {
          setAiLoading(false);
        }
      }
    };

    fetchResults();
  }, [query, aiEnabled, searchEngine]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
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

  const toggleAiEnabled = () => {
    const newValue = !aiEnabled;
    setAiEnabled(newValue);
    localStorage.setItem("karakulakEnabled", newValue.toString());
  };

  return (
    <div className="min-h-screen relative pb-20">
      <main className="p-4 md:p-8">
        {/* Search Header */}
        <div className="max-w-5xl ml-8 mr-auto mb-8">
          <form onSubmit={handleSearch} className="flex items-center w-full max-w-2xl space-x-4">
            <Link href="/">
              <Image src="/tekir.png" alt="Tekir Logo" width={40} height={40} />
            </Link>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search anything..."
              className="flex-1 px-6 py-3 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
            />
            <button 
              type="submit"
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            {/* Toggle switch for Karakulak AI */}
            <div className="relative">
              <input
                type="checkbox"
                id="toggleAi"
                className="sr-only"
                checked={aiEnabled}
                onChange={toggleAiEnabled}
              />
              <label
                htmlFor="toggleAi"
                className="block w-11 h-6 bg-gray-300 rounded-full cursor-pointer transition-colors duration-200 ease-in-out dark:bg-gray-700"
              ></label>
              <div
                className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
                  aiEnabled ? "translate-x-5" : ""
                }`}
              ></div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Karakulak</span>
              <div className="relative group">
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-3 py-1 text-xs bg-gray-700 text-white rounded shadow-lg opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap">
                  Karakulak is the modern AI assistant for Tekir Search. Powered by Gemini 2.0.
                </div>
              </div>
            </div>
          </form>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Search engine:</span>
            <button
              type="button"
              onClick={() => setSearchEngine("brave")}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                searchEngine === "brave"
                  ? "bg-blue-500 text-white"
                  : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
              }`}
            >
              Brave
            </button>
            <button
              type="button"
              onClick={() => setSearchEngine("duck")}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                searchEngine === "duck"
                  ? "bg-blue-500 text-white"
                  : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
              }`}
            >
              DuckDuckGo
            </button>
            <div className="relative group">
              <button
                type="button"
                disabled
                className="px-3 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-500 border border-gray-300 cursor-not-allowed"
              >
                Google
              </button>
              <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                Google support has not been integrated. (yet :P)
              </div>
            </div>
          </div>
        </div>

        {/* Search Results */}
        <div className="max-w-3xl ml-8 mr-auto">
          {query && (
            <p className="text-muted-foreground mb-6">
              Showing results for: <span className="font-medium text-foreground">{query}</span>
            </p>
          )}

          {/* AI Response Box */}
          {aiEnabled && (aiLoading ? (
            <div className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 animate-pulse">
              <div className="flex items-center mb-4">
                <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                  Karakulak AI
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                    BETA
                  </span>
                </span>
              </div>
              <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-1/2"></div>
            </div>
          ) : aiResponse ? (
            <div className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center mb-4">
                <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                  Karakulak AI
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                    BETA
                  </span>
                </span>
              </div>
              <p className="text-blue-800 dark:text-blue-100 mb-3">{aiResponse}</p>
              <p className="text-sm text-blue-600/70 dark:text-blue-300/70">
                Auto-generated based on online sources. May contain inaccuracies.
              </p>
            </div>
          ) : null)}

          {loading ? (
            // Loading skeleton
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-8">
              {results.map((result, index) => (
                <div key={index} className="space-y-2">
                  <a
                    href={result.url}
                    target="_self"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <p className="text-sm text-muted-foreground mb-1">
                      {result.displayUrl}
                    </p>
                    <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                      {result.title}
                    </h2>
                    <p className="text-muted-foreground">
                      {result.description}
                    </p>
                  </a>
                </div>
              ))}
            </div>
          ) : query ? (
            <div className="text-center text-muted-foreground">
              No results found for your search
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Enter a search term to see results
            </div>
          )}
        </div>
      </main>

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
    </div>
  );
}