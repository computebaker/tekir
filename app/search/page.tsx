"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Cat, Instagram, Github, Menu, X, ChevronDown } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { handleBangRedirect } from "@/utils/bangs";

interface SearchResult {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  source: string;
}

interface Suggestion {
  query: string;
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [autocompleteSource, setAutocompleteSource] = useState(() => 
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
  const [hasBang, setHasBang] = useState(false);

  // Refs for click-outside detection
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteDropdownRef = useRef<HTMLDivElement>(null);
  const searchEngineDropdownRef = useRef<HTMLDivElement>(null);

  // Add state for dropdowns visibility
  const [autocompleteDropdownOpen, setAutocompleteDropdownOpen] = useState(false);
  const [searchEngineDropdownOpen, setSearchEngineDropdownOpen] = useState(false);

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

  // Replace the checkForBangs function with our new bang handling
  useEffect(() => {
    const checkQueryForBangs = async () => {
      if (!query) return;
      await handleBangRedirect(query);
    };
    checkQueryForBangs();
  }, [query]);

  // Modify the search results effect
  useEffect(() => {
    if (!query) return;
    
    // Replace the call to checkForBangs with handleBangRedirect
    // We'll use an async IIFE (Immediately Invoked Function Expression)
    (async () => {
      // Try to handle as a bang command first - if it succeeds, stop processing
      const isRedirected = await handleBangRedirect(query);
      if (isRedirected) return;
      
      // Continue with normal search if no bang redirect happened
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
    })();
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
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      // Try to handle as a bang command first
      const redirected = await handleBangRedirect(trimmed);
      if (!redirected) {
        // No bang matched, redirect to normal search
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const toggleAiEnabled = () => {
    const newValue = !aiEnabled;
    setAiEnabled(newValue);
    localStorage.setItem("karakulakEnabled", newValue.toString());
  };

  // Modify the autocomplete effect to handle the new format
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchInput.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      // Check cache first
      const cacheKey = `autocomplete-${autocompleteSource}-${searchInput.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setSuggestions(JSON.parse(cached));
        return;
      }

      try {
        const response = await fetch(`https://autocomplete.tekir.co/${autocompleteSource}?q=${searchInput}`, {
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
  }, [searchInput, autocompleteSource]);

  // Handle keyboard navigation
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
          setSearchInput(selected.query);
          router.push(`/search?q=${encodeURIComponent(selected.query)}`);
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Helper function to detect if input contains a bang
  const checkForBang = (input: string): boolean => {
    // Check for bang pattern (! followed by letters)
    return /(?:^|\s)![a-z]+/.test(input.toLowerCase());
  };
  
  // Update bang detection when search input changes
  useEffect(() => {
    setHasBang(checkForBang(searchInput));
  }, [searchInput]);

  // Add effect to update document title based on search query
  useEffect(() => {
    if (query) {
      document.title = `${query} - Tekir`;
    } else {
      document.title = "Tekir";
    }
  }, [query]);

  // Click outside handler for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle suggestions dropdown
      if (suggestionsRef.current && 
          !suggestionsRef.current.contains(event.target as Node) && 
          showSuggestions) {
        setShowSuggestions(false);
      }
      
      // Handle model dropdown
      if (modelDropdownRef.current && 
          !modelDropdownRef.current.contains(event.target as Node) && 
          modelDropdownOpen) {
        setModelDropdownOpen(false);
      }

      // Autocomplete dropdown
      if (autocompleteDropdownRef.current && 
          !autocompleteDropdownRef.current.contains(event.target as Node) && 
          autocompleteDropdownOpen) {
        setAutocompleteDropdownOpen(false);
      }
      
      // Search engine dropdown
      if (searchEngineDropdownRef.current && 
          !searchEngineDropdownRef.current.contains(event.target as Node) && 
          searchEngineDropdownOpen) {
        setSearchEngineDropdownOpen(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions, modelDropdownOpen, autocompleteDropdownOpen, searchEngineDropdownOpen]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="p-4 md:p-8 flex-grow">
        {/* Search Header */}
        <div className="max-w-5xl w-full md:w-4/5 xl:w-2/3 ml-0 md:ml-8 mb-8 relative">
          <form onSubmit={handleSearch} className="flex items-center w-full space-x-4">
            <Link href="/">
              <Image src="/tekir.png" alt="Tekir Logo" width={40} height={40} />
            </Link>
            <div className="relative flex-1 min-w-0 max-w-3xl mx-auto">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search anything..."
                className="w-full px-4 py-2 pr-8 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
              />
              <button 
                type="submit"
                className="absolute right-0 top-0 h-full flex items-center pr-3"
              >
                <Search className="w-5 h-5" />
              </button>
              
              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className={`absolute w-full mt-2 ${hasBang ? 'mt-6' : 'mt-2'} py-2 bg-background rounded-lg border border-border shadow-lg z-50`}
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.query}
                      onClick={() => {
                        setSearchInput(suggestion.query);
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
                <div ref={searchEngineDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSearchEngineDropdownOpen(!searchEngineDropdownOpen)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center gap-2"
                  >
                    <span>{searchEngine === "brave" ? "Brave" : searchEngine === "duck" ? "DuckDuckGo" : "Google"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${searchEngineDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {searchEngineDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-40 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchEngine("brave");
                            localStorage.setItem("searchEngine", "brave");
                            setSearchEngineDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            searchEngine === "brave" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {searchEngine === "brave" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>Brave</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setSearchEngine("duck");
                            localStorage.setItem("searchEngine", "duck");
                            setSearchEngineDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            searchEngine === "duck" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {searchEngine === "duck" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>DuckDuckGo</span>
                        </button>
                        
                        <button
                          type="button"
                          disabled
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                        >
                          <div className="w-4 h-4"></div>
                          <span>Google (soon)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Autocomplete dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Autocomplete:</span>
                <div ref={autocompleteDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAutocompleteDropdownOpen(!autocompleteDropdownOpen)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center gap-2"
                  >
                    <span>{autocompleteSource === "brave" ? "Brave" : "DuckDuckGo"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${autocompleteDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {autocompleteDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-40 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newSource = 'brave';
                            setAutocompleteSource(newSource);
                            localStorage.setItem('autocompleteSource', newSource);
                            setAutocompleteDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            autocompleteSource === "brave" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {autocompleteSource === "brave" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>Brave</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const newSource = 'duck';
                            setAutocompleteSource(newSource);
                            localStorage.setItem('autocompleteSource', newSource);
                            setAutocompleteDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            autocompleteSource === "duck" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {autocompleteSource === "duck" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>DuckDuckGo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Reintroduced mobile menu block - modified for better sizing */}
          {menuOpen && (
            <div className="md:hidden mt-4 p-4 bg-background rounded shadow-lg">
              {/* Karakulak toggle - unchanged */}
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
              
              {/* Search engine dropdown for mobile - modified sizing */}
              <div className="mt-4">
                <span className="text-sm text-muted-foreground block mb-2">Search engine:</span>
                <div className="inline-block relative" ref={searchEngineDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setSearchEngineDropdownOpen(!searchEngineDropdownOpen)}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center gap-2"
                  >
                    <span>{searchEngine === "brave" ? "Brave" : searchEngine === "duck" ? "DuckDuckGo" : "Google"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${searchEngineDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {searchEngineDropdownOpen && (
                    <div className="absolute left-0 mt-1 min-w-full whitespace-nowrap rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchEngine("brave");
                            localStorage.setItem("searchEngine", "brave");
                            setSearchEngineDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            searchEngine === "brave" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {searchEngine === "brave" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>Brave</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setSearchEngine("duck");
                            localStorage.setItem("searchEngine", "duck");
                            setSearchEngineDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            searchEngine === "duck" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {searchEngine === "duck" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>DuckDuckGo</span>
                        </button>
                        
                        <button
                          type="button"
                          disabled
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                        >
                          <div className="w-4 h-4"></div>
                          <span>Google (soon)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Autocomplete dropdown for mobile - modified sizing */}
              <div className="mt-4">
                <span className="text-sm text-muted-foreground block mb-2">Autocomplete:</span>
                <div className="inline-block relative" ref={autocompleteDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAutocompleteDropdownOpen(!autocompleteDropdownOpen)}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center gap-2"
                  >
                    <span>{autocompleteSource === "brave" ? "Brave" : "DuckDuckGo"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${autocompleteDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {autocompleteDropdownOpen && (
                    <div className="absolute left-0 mt-1 min-w-full whitespace-nowrap rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newSource = 'brave';
                            setAutocompleteSource(newSource);
                            localStorage.setItem('autocompleteSource', newSource);
                            setAutocompleteDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            autocompleteSource === "brave" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {autocompleteSource === "brave" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>Brave</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const newSource = 'duck';
                            setAutocompleteSource(newSource);
                            localStorage.setItem('autocompleteSource', newSource);
                            setAutocompleteDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            autocompleteSource === "duck" ? "bg-gray-100 dark:bg-gray-700" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {autocompleteSource === "duck" && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <span>DuckDuckGo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Results */}
        <div className="max-w-5xl w-full md:w-4/5 xl:w-2/3 ml-0 md:ml-8">
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
                <div className="relative" ref={modelDropdownRef}>
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
      <footer className="w-full py-4 px-6 border-t border-border bg-background mt-auto">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
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