"use client";

import { Suspense } from 'react'; 
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Cat, Instagram, Github, ChevronDown, ExternalLink, ArrowRight, Lock, MessageCircleMore, Image as ImageIcon, Sparkles, Star, Settings, Newspaper } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import UserProfile from "@/components/user-profile";
import Footer from "@/components/footer";
import { handleBangRedirect } from "@/utils/bangs";
import { fetchWithSessionRefreshAndCache, SearchCache } from "@/lib/cache";

// Define mobile navigation items
const mobileNavItems = [
  {
    href: "/about",
    icon: Lock,
    label: "About Tekir"
  },
  {
    href: "https://chat.tekir.co",
    icon: MessageCircleMore,
    label: "AI Chat"
  },
  {
    href: "/settings/search",
    icon: Settings,
    label: "Settings"
  }
];

// The fetchWithSessionRefresh function is now imported from cache.ts
// as fetchWithSessionRefreshAndCache with enhanced caching capabilities for all search types including AI

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
  description?: string;
  language?: string;
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

interface NewsResult {
  title: string;
  description: string;
  url: string;
  source: string;
  age: string;
  thumbnail?: string;
  favicon?: string;
}

// Rename the original SearchPage component
function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  // Helper function to check if a response should hide Karakulak
  const shouldHideKarakulak = (response: string | null): boolean => {
    if (!response) return true;
    
    const trimmedResponse = response.trim();
    if (trimmedResponse === '') return true;
    
    // Common phrases that indicate the AI can't help in various languages
    const cantHelpPhrases = [
      "Sorry, I can't help you with that",
      "I can't help you with that",
      "I cannot help you with that",
      "I'm sorry, but I can't help",
      "I'm unable to help",
      "I cannot assist with that",
      "Sorry, I cannot help",
      "I'm sorry, I can't",
      "Üzgünüm, bu konuda yardımcı olamam", // Turkish
      "Yardımcı olamam",
      "Bu konuda yardımcı olamıyorum",
      "Lo siento, no puedo ayudarte", // Spanish
      "No puedo ayudarte",
      "Désolé, je ne peux pas vous aider", // French
      "Je ne peux pas vous aider",
      "Entschuldigung, ich kann nicht helfen", // German
      "Ich kann nicht helfen",
      "申し訳ありませんが、お手伝いできません", // Japanese
      "抱歉，我无法帮助您", // Chinese
      "Мне жаль, но я не могу помочь", // Russian
    ];
    
    return cantHelpPhrases.some(phrase => 
      trimmedResponse.toLowerCase().includes(phrase.toLowerCase())
    );
  };

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('karakulakEnabled') === 'true' : true
  );
  const [searchEngine, setSearchEngine] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('searchEngine') || 'brave' : 'brave'
  );
  const [aiModel, setAiModel] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('aiModel') || 'gemini' : 'gemini'
  );
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
  const [searchType, setSearchType] = useState<'web' | 'images' | 'news'>('web');
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [newsResults, setNewsResults] = useState<NewsResult[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [aiDiveEnabled, setAiDiveEnabled] = useState(false);
  const [diveResponse, setDiveResponse] = useState<string | null>(null);
  const [diveSources, setDiveSources] = useState<Array<{url: string, title: string, description?: string}>>([]);
  const [diveLoading, setDiveLoading] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const aiRequestInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    const checkQueryForBangs = async () => {
      if (!query) return;
      await handleBangRedirect(query);
    };
    checkQueryForBangs();
  }, [query]);

  useEffect(() => {
    const currentQuery = searchParams.get("q") || "";
    if (!currentQuery) {
      setResults([]);
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    setResults([]);
    setWikiData(null);
    
    // Always fetch regular search results for display, regardless of Dive mode
    const storedEngine = localStorage.getItem("searchEngine") || "brave";
    const engineToUse = storedEngine;

    const fetchRegularSearch = async () => {
      const doFetch = async (engine: string) => {
        try {
          // Get user preferences from localStorage
          const storedCountry = localStorage.getItem("searchCountry") || "ALL";
          const storedSafesearch = localStorage.getItem("safesearch") || "moderate";
          
          // Build query parameters
          const searchParams = new URLSearchParams({
            q: currentQuery,
            country: storedCountry,
            safesearch: storedSafesearch
          });
          
          const response = await fetchWithSessionRefreshAndCache(
            `/api/pars/${engine}?${searchParams}`,
            undefined,
            {
              searchType: 'search',
              provider: engine,
              query: currentQuery,
              searchParams: {
                country: storedCountry,
                safesearch: storedSafesearch
              }
            }
          );
          if (!response.ok) throw new Error(`Search API request failed for ${engine} with query "${currentQuery}" and status ${response.status}`);
          const searchData = await response.json();
          if (isMounted) {
            setResults(searchData);
            setSearchEngine(engine); 
          }
          return true;
        } catch (error) {
          console.error(error);
          if (isMounted) {
          }
          return false;
        }
      };

      const success = await doFetch(engineToUse);
      if (isMounted && !success && engineToUse !== "brave") {
        await doFetch("brave");
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    const timerId = setTimeout(fetchRegularSearch, 1200);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [searchParams, router]);

  useEffect(() => {
    if (!query || searchType !== 'images') return;
    setImageLoading(true);
    fetchWithSessionRefreshAndCache(
      `/api/images/${searchEngine}?q=${encodeURIComponent(query)}`,
      undefined,
      {
        searchType: 'images',
        provider: searchEngine,
        query: query
      }
    ) 
      .then((response) => {
        if (!response.ok) throw new Error(`Image search failed with status ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.results) {
          setImageResults(data.results);
        }
      })
      .catch((error) => console.error("Image search failed:", error))
      .finally(() => setImageLoading(false));
  }, [query, searchEngine, searchType]);

  useEffect(() => {
    if (!query || searchType !== 'news') return;
    setNewsLoading(true);
    
    // Get user preferences from localStorage
    const storedCountry = localStorage.getItem("searchCountry") || "ALL";
    const storedSafesearch = localStorage.getItem("safesearch") || "moderate";
    
    // Build query parameters
    const searchParams = new URLSearchParams({
      q: query,
      country: storedCountry,
      safesearch: storedSafesearch
    });
    
    fetchWithSessionRefreshAndCache(
      `/api/news/${searchEngine}?${searchParams}`,
      undefined,
      {
        searchType: 'news',
        provider: searchEngine,
        query: query,
        searchParams: {
          country: storedCountry,
          safesearch: storedSafesearch
        }
      }
    ) 
      .then((response) => {
        if (!response.ok) throw new Error(`News search failed with status ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.results) {
          setNewsResults(data.results);
        }
      })
      .catch((error) => console.error("News search failed:", error))
      .finally(() => setNewsLoading(false));
  }, [query, searchEngine, searchType]);

  useEffect(() => {
    if (!query || searchType !== 'images') return;

    if (imageResults.length === 0 && !imageLoading) {
      setImageLoading(true);
      fetchWithSessionRefreshAndCache(
        `/api/images/${searchEngine}?q=${encodeURIComponent(query)}`,
        undefined,
        {
          searchType: 'images',
          provider: searchEngine,
          query: query
        }
      )
        .then((response) => {
          if (!response.ok) throw new Error(`Image search failed with status ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (data.results) {
            setImageResults(data.results);
          }
        })
        .catch((error) => console.error("Image search failed:", error))
        .finally(() => setImageLoading(false));
    }
  }, [searchType, query, searchEngine, imageResults.length, imageLoading]);

  useEffect(() => {
    if (!query) {
      aiRequestInProgressRef.current = null;
      return;
    }

    if (!aiEnabled) {
      setAiResponse(null);
      setDiveResponse(null);
      setDiveSources([]);
      aiRequestInProgressRef.current = null;
      return;
    }

    if (aiModel === undefined && localStorage.getItem("aiModel") !== null) {
      return; 
    }

    const modelToUse = aiModel || "gemini";
    
    const requestKey = `${query}-${aiDiveEnabled ? 'dive' : 'ai'}-${modelToUse}`;
    
    if (aiRequestInProgressRef.current === requestKey) {
      return;
    }
    
    aiRequestInProgressRef.current = requestKey;
    setAiLoading(true);
    setDiveLoading(true);

    const isModelEnabled = (model: string) => {
      const stored = localStorage.getItem(`karakulakEnabled_${model}`);
      return stored !== "false";
    };

    const makeAIRequest = async (model: string, isRetry: boolean = false) => {
      try {
        if (aiDiveEnabled) {
          // Dive AI Mode - use existing search results to avoid duplicate API calls
          const cachedDiveResponse = SearchCache.getDive(query);
          
          if (cachedDiveResponse) {
            setDiveResponse(cachedDiveResponse.response);
            setDiveSources(cachedDiveResponse.sources || []);
            setDiveLoading(false);
            setAiResponse(null); // Clear regular AI response when dive is active
            setAiLoading(false);
            aiRequestInProgressRef.current = null;
            return;
          }

          const waitForResults = async (maxAttempts = 10, delay = 300) => {
            for (let i = 0; i < maxAttempts; i++) {
              if (results && results.length > 0) {
                return results;
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            return null;
          };

          const searchResults = await waitForResults();
          
          if (!searchResults || searchResults.length === 0) {
            console.log("No search results available for Dive AI request, skipping...");
            setDiveLoading(false);
            setAiLoading(false);
            aiRequestInProgressRef.current = null;
            return;
          }

          const candidateResults = searchResults.slice(0, 6).map((r: any) => ({
            url: r.url,
            title: r.title,
            snippet: r.description
          }));

          // Call dive API with existing search results
          const diveResponse = await fetchWithSessionRefreshAndCache('/api/dive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, pages: candidateResults })
          });

          if (!diveResponse.ok) {
            throw new Error(`Dive API failed with status ${diveResponse.status}`);
          }

          const diveData = await diveResponse.json();
          setDiveResponse(diveData.response);
          setDiveSources(diveData.sources || []);
          setAiResponse(null); // Clear regular AI response when dive is active
          
          // Cache the dive response using unified cache
          SearchCache.setDive(query, diveData.response, diveData.sources || []);
          
        } else {
          // Regular AI Mode
          const cachedResponse = SearchCache.getAI(model, query);

          if (cachedResponse) {
            setAiResponse(cachedResponse);
            setDiveResponse(null); // Clear dive response when regular AI is active
            setDiveSources([]);
            setAiLoading(false);
            setDiveLoading(false);
            aiRequestInProgressRef.current = null;
            return;
          }

          const res = await fetchWithSessionRefreshAndCache(`/api/karakulak/${model}`, {
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
          setDiveResponse(null); // Clear dive response when regular AI is active
          setDiveSources([]);
          
          // Cache the AI response using unified cache
          SearchCache.setAI(model, query, aiResult);
        }
        
        setAiLoading(false);
        setDiveLoading(false);
        aiRequestInProgressRef.current = null;
      } catch (error) {
        console.error(`AI response failed for model ${model}:`, error);

        if (!isRetry && model !== "gemini" && !aiModel && !aiDiveEnabled) {
          console.log("No user preference found, falling back to Gemini model");
          makeAIRequest("gemini", true);
        } else {
          setAiLoading(false);
          setDiveLoading(false);
          aiRequestInProgressRef.current = null;
        }
      }
    };

    const selectedModelEnabled = isModelEnabled(modelToUse);

    if (selectedModelEnabled) {
      makeAIRequest(modelToUse);
    } else {
      aiRequestInProgressRef.current = null;
    }
  }, [query, aiEnabled, aiModel, aiDiveEnabled]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const trimmed = searchInput.trim();
    if (trimmed) {
      const redirected = await handleBangRedirect(trimmed);
      if (!redirected) {
        const params = new URLSearchParams();
        params.set("q", trimmed);
        router.push(`/search?${params.toString()}`);
      }
    }
  };

  const handleToggleAiDive = () => {
    // Clear any in-progress request when switching modes
    aiRequestInProgressRef.current = null;
    setAiDiveEnabled(prevAiDiveEnabled => !prevAiDiveEnabled);
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchInput.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetchWithSessionRefreshAndCache(`/api/autocomplete/${autocompleteSource}?q=${encodeURIComponent(searchInput)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        if (!response.ok) throw new Error(`Autocomplete fetch failed with status ${response.status}`);
        const data = await response.json();

        if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
          const processedSuggestions = data[1].map(suggestion => ({ query: suggestion }));
          setSuggestions(processedSuggestions);
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
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setWikiData(null);
      return;
    }

    const fetchWikipediaData = async () => {
      setWikiLoading(true);
      try {
        // Get browser language (first 2 characters of the locale)
        const browserLanguage = navigator.language?.slice(0, 2);
        
        // Get search country from localStorage
        const searchCountry = localStorage.getItem("searchCountry") || "ALL";
        
        // Build Wikipedia suggestion API URL with priority parameters
        const suggestionUrl = new URL(`/api/suggest/wikipedia`, window.location.origin);
        suggestionUrl.searchParams.set('q', query);
        
        if (browserLanguage) {
          suggestionUrl.searchParams.set('lang', browserLanguage);
        }
        
        if (searchCountry) {
          suggestionUrl.searchParams.set('country', searchCountry);
        }

        const suggestionResponse = await fetchWithSessionRefreshAndCache(suggestionUrl.toString());
        
        if (!suggestionResponse.ok) {
          throw new Error(`Wikipedia suggestion API failed: ${suggestionResponse.status}`);
        }
        
        const suggestionData = await suggestionResponse.json();
        
        const articleTitle = suggestionData.article;
        const language = suggestionData.language || 'en';

        if (articleTitle) {
          const detailsUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`;
          const detailsResponse = await fetch(detailsUrl);
          const details = await detailsResponse.json();

          if (details.type === "standard" || details.type === "disambiguation") {
            const wikipediaData: WikipediaData = {
              title: details.title,
              extract: details.extract,
              pageUrl: details.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(details.title)}`,
              ...(details.thumbnail && { thumbnail: details.thumbnail }),
              description: details.description,
              language: language,
            };

            setWikiData(wikipediaData);
          } else {
            await fallbackToWikipediaSearch(language);
          }
        } else {
          await fallbackToWikipediaSearch(language);
        }
      } catch (error) {
        console.error("Failed to fetch Wikipedia data:", error);
        setWikiData(null);
      } finally {
        setWikiLoading(false);
      }
    };

    const fallbackToWikipediaSearch = async (language: string = 'en') => {
      try {
        const searchUrl = `https://${language}.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&format=json&utf8=1`;

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.query?.search?.length > 0) {
          const topResult = searchData.query.search[0];
          const pageTitle = topResult.title;

          const detailsUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
          const detailsResponse = await fetch(detailsUrl);
          const details = await detailsResponse.json();

          if (details.type === "standard" || details.type === "disambiguation") {
            const wikipediaData: WikipediaData = {
              title: details.title,
              extract: details.extract,
              pageUrl: details.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(details.title)}`,
              ...(details.thumbnail && { thumbnail: details.thumbnail }),
              description: details.description,
              language: language,
            };

            setWikiData(wikipediaData);
          } else {
            setWikiData(null);
          }
        } else {
          setWikiData(null);
        }
      } catch (error) {
        console.error("Fallback Wikipedia search failed:", error);
        setWikiData(null);
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
    if (storedSearchType === 'web' || storedSearchType === 'images' || storedSearchType === 'news') {
      setSearchType(storedSearchType as 'web' | 'images' | 'news');
    }
  }, []);

  const handleSearchTypeChange = (type: 'web' | 'images' | 'news') => {
    setSearchType(type);
    localStorage.setItem("searchType", type);

    if (type === 'images' && query && imageResults.length === 0 && !imageLoading) {
      setImageLoading(true);
      fetchWithSessionRefreshAndCache(
        `/api/images/${searchEngine}?q=${encodeURIComponent(query)}`,
        undefined,
        {
          searchType: 'images',
          provider: searchEngine,
          query: query
        }
      )
        .then((response) => response.json())
        .then((data) => {
          if (data.results) {
            setImageResults(data.results);
          }
        })
        .catch((error) => console.error("Image search failed:", error))
        .finally(() => setImageLoading(false));
    }

    if (type === 'news' && query && newsResults.length === 0 && !newsLoading) {
      setNewsLoading(true);
      
      // Get user preferences from localStorage
      const storedCountry = localStorage.getItem("searchCountry") || "ALL";
      const storedSafesearch = localStorage.getItem("safesearch") || "moderate";
      
      // Build query parameters
      const searchParams = new URLSearchParams({
        q: query,
        country: storedCountry,
        safesearch: storedSafesearch
      });
      
      fetchWithSessionRefreshAndCache(
        `/api/news/${searchEngine}?${searchParams}`,
        undefined,
        {
          searchType: 'news',
          provider: searchEngine,
          query: query,
          searchParams: {
            country: storedCountry,
            safesearch: storedSafesearch
          }
        }
      )
        .then((response) => response.json())
        .then((data) => {
          if (data.results) {
            setNewsResults(data.results);
          }
        })
        .catch((error) => console.error("News search failed:", error))
        .finally(() => setNewsLoading(false));
    }
  };

  const [followUpQuestion, setFollowUpQuestion] = useState("");

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpQuestion.trim()) return;

    const chatParams = new URLSearchParams({
      originalQuery: query,
      aiResponse: aiResponse || "",
      followUp: followUpQuestion,
    });

    router.push(`https://chat.tekir.co/?${chatParams.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="p-4 md:p-8 flex-grow">
        <div className="max-w-5xl w-full md:w-4/5 xl:w-2/3 ml-0 md:ml-8 md:mr-8 mb-8 relative">
          <form onSubmit={handleSearch} className="flex items-center w-full space-x-2 md:space-x-4">
            <Link href="/">
              <Image src="/tekir-head.png" alt="Tekir Logo" width={40} height={40} />
            </Link>
            <div className="relative flex-1 min-w-0">
              <div className="flex items-center w-full relative">
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
                maxLength={800}
                className="flex-1 px-4 py-2 pr-4 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
                style={{ minWidth: 0 }}
              />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              <button
                type="submit"
                className="p-3 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                title="Search"
              >
                <Search className="w-5 h-5" />
                </button>
              </div>
              </div>
              
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
              <Link href="/settings/search" className="group inline-flex items-center overflow-hidden transition-all duration-300">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="ml-2 whitespace-nowrap max-w-0 group-hover:max-w-[200px] transition-all duration-300 ease-out">
                  Settings
                </span>
              </Link>
              <UserProfile mobileNavItems={mobileNavItems} />
            </div>
            <div className="md:hidden">
              <UserProfile mobileNavItems={mobileNavItems} />
            </div>
          </form>

        </div>

        <div className="max-w-6xl w-full md:ml-8 md:mr-8 relative">
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
                <button
                  onClick={() => handleSearchTypeChange('news')}
                  className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
                >
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4" />
                    <span className={searchType === 'news' ? 'text-primary font-medium' : 'text-muted-foreground group-hover:text-foreground'}>
                      News
                    </span>
                  </div>
                  {searchType === 'news' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" style={{ width: '100%', maxWidth: '48px', margin: '0 auto' }}></div>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:gap-6 lg:gap-8">
            <div className="flex-1 md:w-2/3 lg:w-3/4 xl:w-2/3 2xl:w-3/4">
              {(() => {
                if (searchType !== 'web' || !aiEnabled) return false;
                const hasLoadingOrResponse = aiResponse || diveResponse || aiLoading || diveLoading;
                if (!hasLoadingOrResponse) return false;
                if (aiLoading || diveLoading) return true;
                const activeResponse = diveResponse || aiResponse;
                return !shouldHideKarakulak(activeResponse);
              })() ? (
                <div className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                        Karakulak
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                          BETA
                        </span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleAiDive}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                          aiDiveEnabled 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        title={aiDiveEnabled ? "Disable Dive mode" : "Enable Dive mode"}
                      >
                        <Sparkles className="w-4 h-4 hidden sm:block" />
                        <span>Dive</span>
                      </button>
                    </div>
                  </div>
                  
                  {(aiLoading || diveLoading) ? (
                    <div className="animate-pulse">
                      <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-1/2 mb-3"></div>
                    </div>
                  ) : (
                    <>
                      <p className="text-left text-blue-800 dark:text-blue-100 mb-3">
                        {diveResponse || aiResponse}
                      </p>
                      
                      {diveSources && diveSources.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-2">
                            {diveSources.map((source, index) => (
                              <a
                                key={index}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 text-sm hover:bg-blue-200 dark:hover:bg-blue-800/70 transition-colors"
                                title={source.description}
                              >
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center mr-2">
                                  {index + 1}
                                </span>
                                <span className="truncate max-w-[150px]">{source.title}</span>
                                <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-sm text-blue-600/70 dark:text-blue-300/70 mb-4">
                        {aiDiveEnabled 
                          ? "Generated from web sources. May contain inaccuracies." 
                          : "Auto-generated based on AI knowledge. May contain inaccuracies."
                        }
                      </p>
                      
                      <form onSubmit={handleFollowUpSubmit} className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={followUpQuestion}
                            onChange={(e) => setFollowUpQuestion(e.target.value)}
                            placeholder="Ask a follow-up question..."
                            maxLength={400}
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
                    </>
                  )}
                </div>
              ) : null}
              
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
                    <span className="font-medium">From Wikipedia ({wikiData.language?.toUpperCase() || 'EN'}): {wikiData.title}</span>
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
                      Learn more on Wikipedia ({wikiData.language?.toUpperCase() || 'EN'})
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
              ) : searchType === 'images' ? (
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
              ) : searchType === 'news' ? (
                newsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse border border-border rounded-lg overflow-hidden bg-card">
                        <div className="w-full h-48 bg-muted"></div>
                        <div className="p-4">
                          <div className="h-5 bg-muted rounded w-4/5 mb-2"></div>
                          <div className="h-5 bg-muted rounded w-3/5 mb-4"></div>
                          <div className="h-3 bg-muted rounded w-full mb-2"></div>
                          <div className="h-3 bg-muted rounded w-4/5 mb-4"></div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-muted rounded"></div>
                            <div className="h-3 bg-muted rounded w-20"></div>
                            <div className="h-3 bg-muted rounded w-12"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : newsResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {newsResults.map((article, index) => (
                      <div key={index} className="border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 bg-card">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group h-full"
                        >
                          <div className="relative w-full h-48 bg-muted">
                            {article.thumbnail ? (
                              <div className="relative w-full h-full">
                                <Image 
                                  src={article.thumbnail} 
                                  alt={article.title}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const placeholder = target.parentElement?.querySelector('.image-placeholder');
                                    if (placeholder) {
                                      (placeholder as HTMLElement).style.display = 'flex';
                                    }
                                  }}
                                />
                                <div className="image-placeholder w-full h-full flex items-center justify-center bg-muted" style={{ display: 'none' }}>
                                  <Newspaper className="w-12 h-12 text-muted-foreground/50" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <Newspaper className="w-12 h-12 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="p-4 flex flex-col h-full">
                            {/* Source info at the top */}
                            <div className="flex items-center gap-2 mb-2">
                              {article.favicon && (
                                <Image 
                                  src={article.favicon} 
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="rounded-sm flex-shrink-0"
                                />
                              )}
                              <span className="text-xs text-muted-foreground truncate">
                                {article.source.replace(/^(https?:\/\/)?(www\.)?/, '')}
                                {article.age && (
                                  <>
                                    <span className="mx-1">•</span>
                                    {article.age}
                                  </>
                                )}
                              </span>
                            </div>
                            
                            <h2 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2 mb-2 leading-tight">
                              {article.title}
                            </h2>
                            <p className="text-muted-foreground text-sm line-clamp-2 mb-2 flex-grow">
                              {(() => {
                                const words = article.description.split(' ');
                                if (words.length <= 14) {
                                  return article.description + '...';
                                }
                                return words.slice(0, 14).join(' ') + '...';
                              })()}
                            </p>
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    No news articles found for your search
                  </div>
                )
              ) : null}
            </div>
            
            {searchType === 'web' && (
              <div className="hidden md:block md:w-1/3 lg:w-1/4 xl:w-1/3 2xl:w-1/4">
                {wikiLoading ? (
                  <div className="p-4 lg:p-6 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md animate-pulse">
                    <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                    <div className="w-full h-40 bg-gray-200 dark:bg-gray-600 rounded mb-4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-5/6 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-4/6"></div>
                  </div>
                ) : wikiData ? (
                  <div className="p-4 lg:p-6 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg lg:text-xl font-semibold mb-1 leading-tight">{wikiData.title}</h3>
                    </div>
                    {wikiData.description && (
                      <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mb-3 lg:mb-4">{wikiData.description}</p>
                    )}
                    
                    {wikiData.thumbnail && (
                      <div className="mb-3 lg:mb-4 w-full">
                        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg">
                          <Image 
                            src={wikiData.thumbnail.source} 
                            alt={wikiData.title}
                            className="object-cover"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-3 lg:mb-4">
                      <p className="text-xs lg:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {wikiData.extract}
                      </p>
                    </div>
                    
                    <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                      <span>Read more in </span>
                      <a 
                        href={wikiData.pageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Wikipedia ({wikiData.language?.toUpperCase() || 'EN'})
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  );
}

// Create a new default export component that wraps SearchPageContent in Suspense
export default function SearchPage() {
  return (
    <Suspense fallback={<div></div>}>
      <SearchPageContent />
    </Suspense>
  );
}