"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, Cat, Instagram, Github, Info, Menu, X, ChevronDown } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiModel, setAiModel] = useState("gemini"); // Add this
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false); // Add this

  // Read the AI preference from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem("karakulakEnabled");
    if (stored !== null) {
      setAiEnabled(stored === "true");
    }
  }, []);

  // Add effect to load stored search engine option on mount
  useEffect(() => {
    const storedEngine = localStorage.getItem("searchEngine");
    if (storedEngine) {
      setSearchEngine(storedEngine);
    }
  }, []);

  // Add effect to load stored model preference
  useEffect(() => {
    const storedModel = localStorage.getItem("aiModel");
    if (storedModel) {
      setAiModel(storedModel);
    }
  }, []);

  // Add this new function before the effects
  const checkForBangs = (searchText: string) => {
    const trimmed = searchText.trim();
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
    } else if (trimmed.includes("!y")) {
      const q = trimmed.replace("!y", "").trim();
      window.location.href = `https://yandex.com/search/?text=${encodeURIComponent(q)}`;
      return;
    } else if (trimmed.includes("!ask")) {
      const q = trimmed.replace("!ask", "").trim();
      window.location.href = `https://www.ask.com/web?q=${encodeURIComponent(q)}`;
      return;
    } else if (trimmed.includes("!b")) {
      const q = trimmed.replace("!b", "").trim();
      window.location.href = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
      return;
    }
    return false;
  };

  // Modify the search results effect
  useEffect(() => {
    if (!query) return;
    
    // Check for bangs in the query parameter
    if (checkForBangs(query)) return;
    
    const cachedSearch = sessionStorage.getItem(`search-${searchEngine}-${query}`);
    if (cachedSearch) {
      const { results: cachedResults } = JSON.parse(cachedSearch);
      setResults(cachedResults);
      // continue to update search results even if cached for new search engine
    }
    
    setLoading(true);
    fetch(
      `https://searchapi.tekir.co/api?q=${encodeURIComponent(query)}&source=${searchEngine}`
    )
      .then((response) => response.json())
      .then((searchData) => {
        setResults(searchData);
        sessionStorage.setItem(
          `search-${searchEngine}-${query}`,
          JSON.stringify({ results: searchData })
        );
      })
      .catch((error) => console.error("Search failed:", error))
      .finally(() => setLoading(false));
  }, [query, searchEngine]);

  // Modify the AI effect
  useEffect(() => {
    if (!query) return;
    
    if (!aiEnabled) {
      setAiResponse(null);
      return;
    }
    
    // Update cache key to include model name
    const cacheKey = `ai-${query}-${aiModel}`;
    const cachedAi = sessionStorage.getItem(cacheKey);
    if (cachedAi) {
      setAiResponse(JSON.parse(cachedAi));
      return;
    }
    
    setAiLoading(true);
    if (localStorage.getItem("karakulakEnabled") === "false") {
      return;
    } else {
      fetch("https://searchai.tekir.co/" + aiModel, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: query.replace(/%20/g, " ") }),
      })
        .then((res) => res.json())
        .then((aiData) => {
          const aiResult = aiData.result.trim();
          setAiResponse(aiResult);
          // Store with model-specific cache key
          sessionStorage.setItem(cacheKey, JSON.stringify(aiResult));
        })
        .catch((error) => console.error("AI response failed:", error))
        .finally(() => setAiLoading(false));
    }
  }, [query, aiEnabled, aiModel]);

  // Add the model selection function
  const handleModelChange = (model: string) => {
    setAiModel(model);
    setModelDropdownOpen(false);
    localStorage.setItem("aiModel", model);
  };

  // Modify the handleSearch function
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      // Check for bangs in the search input
      if (!checkForBangs(trimmed)) {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
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
        <div className="max-w-5xl ml-0 md:ml-8 mb-8 relative">
          <form onSubmit={handleSearch} className="flex items-center w-full space-x-4">
            <Link href="/">
              <Image src="/tekir.png" alt="Tekir Logo" width={40} height={40} />
            </Link>
            <div className="relative flex-1 min-w-0 max-w-3xl mx-auto">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search anything..."
                className="w-full px-4 py-2 pr-8 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
              />
              <button 
                type="submit"
                className="absolute right-0 top-0 h-full flex items-center pr-3"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            {/* Remove inline desktop options */}
            {/* Mobile menu toggle remains inside the form */}
            <button 
              type="button" 
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </form>

          {/* New desktop-only options block below the search bar */}
          <div className="hidden md:flex flex-col mt-4">
            <div className="flex items-center gap-4">
              {/* Karakulak slider */}
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground">Karakulak</span>
                <div className="relative ml-2">
                  <input 
                    type="checkbox" 
                    id="toggleAi-desktop" 
                    className="sr-only" 
                    checked={aiEnabled} 
                    onChange={toggleAiEnabled} 
                  />
                  <label 
                    htmlFor="toggleAi-desktop" 
                    className="block w-11 h-6 bg-gray-300 rounded-full cursor-pointer transition-colors duration-200 ease-in-out dark:bg-gray-700"
                  ></label>
                  <div 
                    className={`absolute top-0 left-0 h-6 w-6 flex items-center justify-center bg-white rounded-full transition-transform duration-200 ease-in-out ${aiEnabled ? "translate-x-5" : ""}`}
                  ></div>
                </div>
              </div>
              {/* Search engine selection */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Search engine:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchEngine("brave");
                    localStorage.setItem("searchEngine", "brave");
                  }}
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
                  onClick={() => {
                    setSearchEngine("duck");
                    localStorage.setItem("searchEngine", "duck");
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    searchEngine === "duck"
                      ? "bg-blue-500 text-white"
                      : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                  }`}
                >
                  DuckDuckGo
                </button>
                <button
                  type="button"
                  disabled
                  className="px-3 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-500 border border-gray-300 cursor-not-allowed"
                >
                  Google
                </button>
              </div>
            </div>
          </div>
          {/* Reintroduced mobile menu block */}
          {menuOpen && (
            <div className="md:hidden mt-4 p-4 bg-background rounded shadow-lg">
              <div className="flex items-center gap-1 relative">
                <div className="relative group">

                </div>
                <input 
                  type="checkbox" 
                  id="toggleAi-mobile" 
                  className="sr-only" 
                  checked={aiEnabled} 
                  onChange={toggleAiEnabled} 
                />
                <label 
                  htmlFor="toggleAi-mobile" 
                  className="block w-11 h-6 bg-gray-300 rounded-full cursor-pointer transition-colors duration-200 ease-in-out dark:bg-gray-700"
                ></label>
                {/* Updated mobile slider ball */}
                <div
                  className={`absolute left-0 top-0 h-6 w-6 flex items-center justify-center bg-white rounded-full transition-transform duration-200 ease-in-out ${
                    aiEnabled ? "translate-x-5" : ""
                  }`}
                ></div>
                <span className="text-sm text-muted-foreground">Karakulak</span>

              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground">Search engine:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchEngine("brave");
                    localStorage.setItem("searchEngine", "brave");
                  }}
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
                  onClick={() => {
                    setSearchEngine("duck");
                    localStorage.setItem("searchEngine", "duck");
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    searchEngine === "duck"
                      ? "bg-blue-500 text-white"
                      : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                  }`}
                >
                  DuckDuckGo
                </button>
                <button
                  type="button"
                  disabled
                  className="px-3 py-1 rounded-full text-sm font-medium bg-gray-300 text-gray-500 border border-gray-300 cursor-not-allowed"
                >
                  Google
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search Results */}
        <div className="max-w-3xl ml-0 md:ml-8">
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                    Karakulak AI
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                      BETA
                    </span>
                  </span>
                </div>
                
                {/* Model Selection Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {aiModel === 'llama' ? (
                      <>
                        <Image src="/meta.png" alt="Meta Logo" width={20} height={20} className="rounded" />
                      </>
                    ) : aiModel === 'mistral' ? (
                      <>
                        <Image src="/mistral.png" alt="Mistral Logo" width={20} height={20} className="rounded" />
                      </>
                    ) : (
                      <>
                        <Image src="/google.png" alt="Google Logo" width={20} height={20} className="rounded" />
                      </>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {modelDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
                      <div className="p-1">
                        <button
                          onClick={() => handleModelChange('llama')}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            aiModel === 'llama' ? 'bg-gray-100 dark:bg-gray-700' : ''
                          }`}
                        >
                          <Image src="/meta.png" alt="Meta Logo" width={20} height={20} className="rounded" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Llama 3.1 7B</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 text-left">A powerful and open-source model by Meta</span>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => handleModelChange('gemini')}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            aiModel === 'gemini' ? 'bg-gray-100 dark:bg-gray-700' : ''
                          }`}
                        >
                          <Image src="/google.png" alt="Google Logo" width={20} height={20} className="rounded" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Gemini 2.0 Flash</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 text-left">A fast and intelligent model by Google</span>
                          </div>
                        </button>

                        <button
                          onClick={() => handleModelChange('mistral')}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            aiModel === 'mistral' ? 'bg-gray-100 dark:bg-gray-700' : ''
                          }`}
                        >
                          <Image src="/mistral.png" alt="Mistral Logo" width={20} height={20} className="rounded" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Mistral Nemo</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 text-left">A lightweight and efficient model by Mistral AI</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Rest of the AI response box content */}
              <p className="text-left text-blue-800 dark:text-blue-100 mb-3">{aiResponse}</p>
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
        <div className="max-w-5xl ml-0 md:ml-8 flex justify-between items-center">
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