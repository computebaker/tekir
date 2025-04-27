"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Cat, Instagram, Github, Menu, X, ChevronDown, ExternalLink, ArrowRight, Lock, MessageCircleMore, Image as ImageIcon } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
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

interface WikipediaData {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  pageUrl: string;
}

interface ImageSearchResult {
  title: string;
  url: string;
  source: string;
  thumbnail: {
    src: string;
  };
  properties: {
    url: string;
    placeholder: string;
  };
  meta_url: {
    netloc: string;
    path: string;
  };
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
  const [aiEnabled, setAiEnabled] = useState(true);
  const [searchEngine, setSearchEngine] = useState("brave");
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiModel, setAiModel] = useState<string>();
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [autocompleteSource, setAutocompleteSource] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
  const [hasBang, setHasBang] = useState(false);
  const [wikiData, setWikiData] = useState<WikipediaData | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiExpanded, setWikiExpanded] = useState(false);
  const [searchType, setSearchType] = useState<'web' | 'images'>('web');
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [imageLoading, setImageLoading] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteDropdownRef = useRef<HTMLDivElement>(null);
  const searchEngineDropdownRef = useRef<HTMLDivElement>(null);

  const [autocompleteDropdownOpen, setAutocompleteDropdownOpen] = useState(false);
  const [searchEngineDropdownOpen, setSearchEngineDropdownOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("karakulakEnabled");
    if (stored !== null) {
      setAiEnabled(stored === "true");
    }
  }, []);

  useEffect(() => {
    const storedEngine = localStorage.getItem("searchEngine");
    if (storedEngine) {
      setSearchEngine(storedEngine);
    }
  }, []);

  useEffect(() => {
    const storedModel = localStorage.getItem("aiModel");
    if (storedModel) {
      setAiModel(storedModel);
    }
  }, []);

  useEffect(() => {
    const checkQueryForBangs = async () => {
      if (!query) return;
      await handleBangRedirect(query);
    };
    checkQueryForBangs();
  }, [query]);

  useEffect(() => {
    if (!query) return;

    (async () => {
      const isRedirected = await handleBangRedirect(query);
      if (isRedirected) return;

      const storedEngine = localStorage.getItem("searchEngine") || "brave";
      let engineToUse = storedEngine;

      const cachedSearch = sessionStorage.getItem(`search-${engineToUse}-${query}`);
      if (cachedSearch) {
        const { results: cachedResults } = JSON.parse(cachedSearch);
        setResults(cachedResults);
      }

      setLoading(true);

      const fetchWithEngine = async (engine: string) => {
        try {
          const response = await fetch(`/api/pars/${engine}?q=${encodeURIComponent(query)}`);
          if (!response.ok) throw new Error("Fetch failed");
          const searchData = await response.json();
          setResults(searchData);
          sessionStorage.setItem(
            `search-${engine}-${query}`,
            JSON.stringify({ results: searchData })
          );
          setSearchEngine(engine);
          return true;
        } catch {
          return false;
        }
      };

      setTimeout(async () => {
        const success = await fetchWithEngine(engineToUse);
        if (!success && engineToUse !== "brave") {
          await fetchWithEngine("brave");
        }
        setLoading(false);
      }, 1200);
    })();
  }, [query]);

  useEffect(() => {
    if (!query || searchType !== 'images') return;

    const cachedImages = sessionStorage.getItem(`images-${searchEngine}-${query}`);
    if (cachedImages) {
      const { results: cachedResults } = JSON.parse(cachedImages);
      setImageResults(cachedResults);
    }

    setImageLoading(true);
    fetch(`/api/images/${searchEngine}?q=${encodeURIComponent(query)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.results) {
          setImageResults(data.results);
          sessionStorage.setItem(
            `images-${searchEngine}-${query}`,
            JSON.stringify({ results: data.results })
          );
        }
      })
      .catch((error) => console.error("Image search failed:", error))
      .finally(() => setImageLoading(false));
  }, [query, searchEngine, searchType]);

  useEffect(() => {
    if (!query || searchType !== 'images') return;

    if (imageResults.length === 0 && !imageLoading) {
      const cachedImages = sessionStorage.getItem(`images-${searchEngine}-${query}`);
      if (cachedImages) {
        const { results: cachedResults } = JSON.parse(cachedImages);
        setImageResults(cachedResults);
      } else {
        setImageLoading(true);
        fetch(`/api/images/${searchEngine}?q=${encodeURIComponent(query)}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.results) {
              setImageResults(data.results);
              sessionStorage.setItem(
                `images-${searchEngine}-${query}`,
                JSON.stringify({ results: data.results })
              );
            }
          })
          .catch((error) => console.error("Image search failed:", error))
          .finally(() => setImageLoading(false));
      }
    }
  }, [searchType, query, searchEngine, imageResults.length, imageLoading]);

  useEffect(() => {
    if (!query) return;

    if (!aiEnabled) {
      setAiResponse(null);
      return;
    }

    if (aiModel === undefined && localStorage.getItem("aiModel") !== null) {
      return; 
    }

    const modelToUse = aiModel || "gemini";
    const cacheKey = `ai-${query}-${modelToUse}`;
    const cachedAi = sessionStorage.getItem(cacheKey);
    if (cachedAi) {
      setAiResponse(JSON.parse(cachedAi));
      return;
    }

    setAiLoading(true);

    const isModelEnabled = (model: string) => {
      const stored = localStorage.getItem(`karakulakEnabled_${model}`);
      return stored !== "false";
    };

    const makeAIRequest = async (model: string, isRetry: boolean = false) => {
      try {
        const res = await fetch(`/api/karakulak/${model}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: query }),
        });

        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`);
        }

        const aiData = await res.json();
        const aiResult = aiData.answer.trim();
        setAiResponse(aiResult);
        sessionStorage.setItem(`ai-${query}-${model}`, JSON.stringify(aiResult));
        setAiLoading(false);
      } catch (error) {
        console.error(`AI response failed for model ${model}:`, error);

        if (!isRetry && model !== "gemini" && !aiModel) {
          console.log("No user preference found, falling back to Gemini model");
          makeAIRequest("gemini", true);
        } else {
          setAiLoading(false);
        }
      }
    };

    const selectedModelEnabled = isModelEnabled(modelToUse);

    if (selectedModelEnabled) {
      makeAIRequest(modelToUse);
    }
  }, [query, aiEnabled, aiModel]);

  const handleModelChange = (model: string) => {
    setAiModel(model);
    setModelDropdownOpen(false);
    localStorage.setItem("aiModel", model);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const trimmed = searchInput.trim();
    if (trimmed) {
      const redirected = await handleBangRedirect(trimmed);
      if (!redirected) {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const toggleAiEnabled = () => {
    const newValue = !aiEnabled;
    setAiEnabled(newValue);
    localStorage.setItem("karakulakEnabled", newValue.toString());
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchInput.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      const cacheKey = `autocomplete-${autocompleteSource}-${searchInput.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setSuggestions(JSON.parse(cached));
        return;
      }

      try {
        const response = await fetch(`/api/autocomplete/${autocompleteSource}?q=${encodeURIComponent(searchInput)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        const data = await response.json();

        if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
          const processedSuggestions = data[1].map(suggestion => ({ query: suggestion }));
          setSuggestions(processedSuggestions);
          sessionStorage.setItem(cacheKey, JSON.stringify(processedSuggestions));
        } else {
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
        } else {
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const checkForBang = (input: string): boolean => {
    return /(?:^|\s)![a-z]+/.test(input.toLowerCase());
  };

  useEffect(() => {
    setHasBang(checkForBang(searchInput));
  }, [searchInput]);

  useEffect(() => {
    if (query) {
      document.title = `${query} - Tekir`;
    } else {
      document.title = "Tekir";
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current &&
          !suggestionsRef.current.contains(event.target as Node) &&
          showSuggestions) {
        setShowSuggestions(false);
      }

      if (modelDropdownRef.current &&
          !modelDropdownRef.current.contains(event.target as Node) &&
          modelDropdownOpen) {
        setModelDropdownOpen(false);
      }

      if (autocompleteDropdownRef.current &&
          !autocompleteDropdownRef.current.contains(event.target as Node) &&
          autocompleteDropdownOpen) {
        setAutocompleteDropdownOpen(false);
      }

      if (searchEngineDropdownRef.current &&
          !searchEngineDropdownRef.current.contains(event.target as Node) &&
          searchEngineDropdownOpen) {
        setSearchEngineDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions, modelDropdownOpen, autocompleteDropdownOpen, searchEngineDropdownOpen]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setWikiData(null);
      return;
    }

    const fetchWikipediaData = async () => {
      const cacheKey = `wiki-${query.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setWikiData(JSON.parse(cached));
        return;
      }

      setWikiLoading(true);
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&format=json&utf8=1`;

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.query?.search?.length > 0) {
          const topResult = searchData.query.search[0];
          const pageTitle = topResult.title;

          const detailsUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
          const detailsResponse = await fetch(detailsUrl);
          const details = await detailsResponse.json();

          if (details.type === "standard" || details.type === "disambiguation") {
            const wikipediaData: WikipediaData = {
              title: details.title,
              extract: details.extract,
              pageUrl: details.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(details.title)}`,
              ...(details.thumbnail && { thumbnail: details.thumbnail })
            };

            setWikiData(wikipediaData);
            sessionStorage.setItem(cacheKey, JSON.stringify(wikipediaData));
          } else {
            setWikiData(null);
          }
        } else {
          setWikiData(null);
        }
      } catch (error) {
        console.error("Failed to fetch Wikipedia data:", error);
        setWikiData(null);
      } finally {
        setWikiLoading(false);
      }
    };

    if (!hasBang) {
      fetchWikipediaData();
    } else {
      setWikiData(null);
    }
  }, [query, hasBang]);

  useEffect(() => {
    const storedSearchType = localStorage.getItem("searchType");
    if (storedSearchType === 'web' || storedSearchType === 'images') {
      setSearchType(storedSearchType as 'web' | 'images');
    }
  }, []);

  const handleSearchTypeChange = (type: 'web' | 'images') => {
    setSearchType(type);
    localStorage.setItem("searchType", type);

    if (type === 'images' && query && imageResults.length === 0 && !imageLoading) {
      const cachedImages = sessionStorage.getItem(`images-${searchEngine}-${query}`);
      if (cachedImages) {
        const { results: cachedResults } = JSON.parse(cachedImages);
        setImageResults(cachedResults);
      } else {
        setImageLoading(true);
        fetch(`/api/images/${searchEngine}?q=${encodeURIComponent(query)}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.results) {
              setImageResults(data.results);
              sessionStorage.setItem(
                `images-${searchEngine}-${query}`,
                JSON.stringify({ results: data.results })
              );
            }
          })
          .catch((error) => console.error("Image search failed:", error))
          .finally(() => setImageLoading(false));
      }
    }
  };

  const [followUpQuestion, setFollowUpQuestion] = useState("");

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpQuestion.trim()) return;

    const localAi = localStorage.getItem("aiModel");
    const aiModel =
      localAi === "gemini"
        ? "gemini-2.0-flash"
        : localAi === "mistral"
        ? "mistral-7b"
        : localAi === "chatgpt"
        ? "gpt-4o-mini"
        : "llama-3-1-80b";
    const chatParams = new URLSearchParams({
      originalQuery: query,
      aiResponse: aiResponse || "",
      followUp: followUpQuestion,
      model: aiModel || "llama-3-1-80b"
    });

    router.push(`/chat?${chatParams.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="p-4 md:p-8 flex-grow">
        <div className="max-w-5xl w-full md:w-4/5 xl:w-2/3 ml-0 md:ml-8 mb-8 relative">
          <form onSubmit={handleSearch} className="flex items-center w-full space-x-4">
            <Link href="/">
              <Image src="/tekir-head.png" alt="Tekir Logo" width={40} height={40} />
            </Link>
            <div className="relative flex-1 min-w-0">
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
            <div className="hidden md:flex items-center gap-4">
              <Link href="/about" className="group inline-flex items-center overflow-hidden transition-all duration-300">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <span className="ml-2 whitespace-nowrap max-w-0 group-hover:max-w-[200px] transition-all duration-300 ease-out">
                  Your searches are private.
                </span>
              </Link>
              <Link href="https://chat.tekir.co" className="group inline-flex items-center overflow-hidden transition-all duration-300">
                <MessageCircleMore className="w-5 h-5 text-muted-foreground" />
                <span className="ml-2 whitespace-nowrap max-w-0 group-hover:max-w-[200px] transition-all duration-300 ease-out">
                  AI Chat
                </span>
              </Link>
            </div>
            <button 
              type="button" 
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </form>

          <div className="hidden md:flex flex-col mt-4">
            <div className="flex items-center gap-4">
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
                    <div className="absolute left-0 mt-1 w-40 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
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
                    <div className="absolute left-0 mt-1 w-40 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
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
                <div
                  className={`absolute left-0 top-0 h-6 w-6 flex items-center justify-center bg-white rounded-full transition-transform duration-200 ease-in-out ${
                    aiEnabled ? "translate-x-5" : ""
                  }`}
                ></div>
                <span className="text-sm text-muted-foreground">Karakulak</span>
              </div>
              
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
                    <div className="absolute left-0 mt-1 min-w-full whitespace-nowrap rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
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
                    <div className="absolute left-0 mt-1 min-w-full whitespace-nowrap rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
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

        <div className="max-w-6xl w-full md:ml-8 relative">
          {query && (
            <p className="text-muted-foreground mb-4 md:w-4/5 xl:w-2/3">
              Showing results for: <span className="font-medium text-foreground">{query}</span>
            </p>
          )}

          {query && (
            <div className="mb-6 border-b border-border">
              <div className="flex space-x-4">
                <button
                  onClick={() => handleSearchTypeChange('web')}
                  className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span className={searchType === 'web' ? 'text-primary font-medium' : 'text-muted-foreground group-hover:text-foreground'}>
                      Search
                    </span>
                  </div>
                  {searchType === 'web' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" style={{ width: '100%', maxWidth: '62px', margin: '0 auto' }}></div>
                  )}
                </button>
                <button
                  onClick={() => handleSearchTypeChange('images')}
                  className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
                >
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    <span className={searchType === 'images' ? 'text-primary font-medium' : 'text-muted-foreground group-hover:text-foreground'}>
                      Images
                    </span>
                  </div>
                  {searchType === 'images' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" style={{ width: '100%', maxWidth: '64px', margin: '0 auto' }}></div>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:gap-8">
            <div className="flex-1 md:w-4/5 xl:w-2/3">
              {searchType === 'web' && aiEnabled && (aiLoading ? (
                <div className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 animate-pulse">
                  <div className="flex items-center mb-4">
                    <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                      Karakulak AI
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                        BETA
                      </span>
                      <Link href="https://chat.tekir.co" className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                        Try Tekir Chat →
                      </Link>
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
                        <Link href="https://chat.tekir.co" className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                          Try Tekir Chat →
                        </Link>
                      </span>
                    </div>
                    
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
                        ) : aiModel === 'chatgpt' ? (
                          <>
                            <Image src="/openai.png" alt="OpenAI Logo" width={20} height={20} className="rounded" />
                          </>
                        ) : (
                          <>
                            <Image src="/google.png" alt="Google Logo" width={20} height={20} className="rounded" />
                          </>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {modelDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
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
                              onClick={() => handleModelChange('chatgpt')}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                aiModel === 'chatgpt' ? 'bg-gray-100 dark:bg-gray-700' : ''
                              }`}
                            >
                              <Image src="/openai.png" alt="OpenAI Logo" width={20} height={20} className="rounded" />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">GPT 4o-mini</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 text-left">Powerful, efficient model by OpenAI</span>
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
                  
                  <p className="text-left text-blue-800 dark:text-blue-100 mb-3">{aiResponse}</p>
                  <p className="text-sm text-blue-600/70 dark:text-blue-300/70 mb-4">
                    Auto-generated based on online sources. May contain inaccuracies.
                  </p>
                  
                  <form onSubmit={handleFollowUpSubmit} className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={followUpQuestion}
                        onChange={(e) => setFollowUpQuestion(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        className="flex-1 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={!followUpQuestion.trim()}
                        className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Ask follow-up question"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>
              ) : null)}
              
              {searchType === 'web' && (
                <div className="md:hidden">
                {wikiLoading ? (
                  <div className="mb-8 p-4 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md animate-pulse">
                  <div className="flex items-center mb-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3"></div>
                  </div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                  </div>
                ) : wikiData ? (
                  <div className="mb-8 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
                  <button 
                    onClick={() => setWikiExpanded(!wikiExpanded)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center">
                    <span className="font-medium">From Wikipedia: {wikiData.title}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${wikiExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {wikiExpanded && (
                    <div className="p-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {wikiData.thumbnail && (
                      <div className="float-right ml-4 mb-2">
                      <div className="relative w-32 h-32 overflow-hidden rounded-lg">
                        <Image 
                        src={wikiData.thumbnail.source} 
                        alt={wikiData.title}
                        className="object-cover"
                        fill
                        sizes="128px"
                        />
                      </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      {wikiData.extract}
                    </p>
                    <a 
                      href={wikiData.pageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Learn more
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    </div>
                  )}
                  </div>
                ) : null}
                </div>
              )}

              {searchType === 'web' ? (
                loading ? (
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
                )
              ) : (
                imageLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-muted rounded-lg w-full"></div>
                        <div className="h-4 bg-muted rounded w-3/4 mt-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mt-1"></div>
                      </div>
                    ))}
                  </div>
                ) : imageResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {imageResults.map((image, index) => (
                      <a 
                        key={index} 
                        href={image.url} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group overflow-hidden"
                      >
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-muted mb-2">
                          <Image 
                            src={image.thumbnail.src} 
                            alt={image.title || "Image"} 
                            fill 
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            placeholder="blur"
                            blurDataURL={image.properties.placeholder || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDUwMCA1MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwMCIgaGVpZ2h0PSI1MDAiIGZpbGw9IiNFNkU2RTYiLz48L3N2Zz4="}
                          />
                        </div>
                        <p className="text-sm font-medium truncate">{image.title || "Image"}</p>
                        <p className="text-xs text-muted-foreground truncate">{image.source}</p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    No images found for your search
                  </div>
                )
              )}
            </div>
            
            {searchType === 'web' && (
              <div className="hidden md:block md:w-1/3">
                {wikiLoading ? (
                  <div className="p-6 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md animate-pulse">
                    <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                    <div className="w-full h-40 bg-gray-200 dark:bg-gray-600 rounded mb-4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-5/6 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-4/6"></div>
                  </div>
                ) : wikiData ? (
                  <div className="p-6 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md">
                    <h3 className="text-xl font-semibold mb-4">{wikiData.title}</h3>
                    
                    {wikiData.thumbnail && (
                      <div className="mb-4 w-full">
                        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg">
                          <Image 
                            src={wikiData.thumbnail.source} 
                            alt={wikiData.title}
                            className="object-cover"
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {wikiData.extract}
                      </p>
                    </div>
                    
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <span>Source: </span>
                      <a 
                        href={wikiData.pageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Wikipedia
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full py-4 px-6 border-t border-border bg-background mt-auto">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-muted-foreground">
            Tekir, built by <a href="https://computebaker.com" className="text-primary hover:underline">computebaker</a>.
            </p>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms
            </Link>
          </div>
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
              href="https://github.com/computebaker"
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