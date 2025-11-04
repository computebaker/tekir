"use client";

import { Suspense } from 'react'; 
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Cat, ChevronDown, ExternalLink, ArrowRight, Lock, MessageCircleMore, Sparkles, Settings, Newspaper, Video, AlertTriangle, X } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";
import UserProfile from "@/components/user-profile";
import Footer from "@/components/footer";
import { handleBangRedirect } from "@/utils/bangs";
import { fetchWithSessionRefreshAndCache, SearchCache } from "@/lib/cache";
import { apiEndpoints } from "@/lib/migration-config";
import { useAuth } from "@/components/auth-provider";
import { Input, SearchInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SearchTabs from "@/components/search/search-tabs";
import WebResultItem from "@/components/search/web-result-item";
import FlyingCats from "@/components/shared/flying-cats";
import WikiNotebook from '@/components/wiki-notebook';
import FloatingFeedback from '@/components/feedback/floating-feedback';
import { storeRedirectUrl } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getLogoMetadata } from "@/components/settings/logo-selector";

interface SearchResult {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  source: string;
  favicon?: string;
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
  const { settings } = useSettings();
  const t = useTranslations();

  const mobileNavItems = useMemo(() => [
    { href: "/about", icon: Lock, label: t('navigation.about') },
    { href: "https://chat.tekir.co", icon: MessageCircleMore, label: t('navigation.aiChat') },
    { href: "/settings/search", icon: Settings, label: t('navigation.settings') }
  ], [t]);

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
  const [videoResults, setVideoResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('karakulakEnabled') === 'true' : true
  );
  const { status: authStatus, user } = useAuth();
  const isAuthenticated = authStatus === 'authenticated' && !!user;
  const [searchEngine, setSearchEngine] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('searchEngine') || 'brave' : 'brave'
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('searchEngine');
    if (stored && !['brave', 'google', 'you'].includes(stored)) {
      localStorage.setItem('searchEngine', 'brave');
      setSearchEngine('brave');
      return;
    }
    if (!isAuthenticated && stored === 'google') {
      localStorage.setItem('searchEngine', 'brave');
      setSearchEngine('brave');
    }
  }, [isAuthenticated]);
  const [aiModel, setAiModel] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('aiModel') || 'gemini' : 'gemini'
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [autocompleteSource, setAutocompleteSource] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('autocompleteSource') || 'brave' : 'brave'
  );
  const checkForBang = (input: string): boolean => {
    return /(?:^|\s)![a-z]+/.test((input || "").toLowerCase());
  };
  const hasBang = useMemo(() => checkForBang(searchInput), [searchInput]);

  const getEngineForMode = useCallback(
    (engine: string, mode: 'web' | 'images' | 'news' | 'videos'): 'brave' | 'google' | 'you' => {
      if (!isAuthenticated && engine === 'google') {
        return 'brave';
      }
      if (engine === 'you' && mode !== 'web') {
        return 'brave';
      }
      if (engine !== 'brave' && engine !== 'google' && engine !== 'you') {
        return 'brave';
      }
      return engine as 'brave' | 'google' | 'you';
    },
    [isAuthenticated]
  );
  const [wikiData, setWikiData] = useState<WikipediaData | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiExpanded, setWikiExpanded] = useState(false);
  const [wikiReadMore, setWikiReadMore] = useState(false);
  const [searchType, setSearchType] = useState<'web' | 'images' | 'news' | 'videos'>('web');
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [newsResults, setNewsResults] = useState<NewsResult[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [aiDiveEnabled, setAiDiveEnabled] = useState(false);
  const [diveResponse, setDiveResponse] = useState<string | null>(null);
  const [diveSources, setDiveSources] = useState<Array<{url: string, title: string, description?: string}>>([]);
  const [diveLoading, setDiveLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [diveError, setDiveError] = useState(false);
  const [karakulakCollapsed, setKarakulakCollapsed] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const aiRequestInProgressRef = useRef<string | null>(null);
  const searchIdRef = useRef(0);
  const lastResultsQueryRef = useRef<string | null>(null);
  const webSearchAbortRef = useRef<AbortController | null>(null);
  const imagesAbortRef = useRef<AbortController | null>(null);
  const newsAbortRef = useRef<AbortController | null>(null);
  const videosAbortRef = useRef<AbortController | null>(null);
  const imageRetryRef = useRef(false);
  const newsRetryRef = useRef(false);
  const videoRetryRef = useRef(false);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const wikipediaAbortRef = useRef<AbortController | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

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
      setAiResponse(null);
      setDiveResponse(null);
      setDiveSources([]);
      return;
    }
    let isMounted = true;
    setLoading(true);
    setResults([]);
    setWikiData(null);
  setDiveResponse(null);
  setDiveSources([]);
  setAiResponse(null);
  // Loading flags will be set by a dedicated effect reacting to AI/Dive mode
  // Clear previous errors on new query
  setAiError(false);
  setDiveError(false);
    aiRequestInProgressRef.current = null;
    
    const searchId = ++searchIdRef.current;
    
    // Always fetch regular search results for display, regardless of Dive mode
    const storedEngine = localStorage.getItem("searchEngine") || "brave";
    const engineToUse = getEngineForMode(storedEngine, 'web');
    if (engineToUse !== storedEngine) {
      localStorage.setItem('searchEngine', engineToUse);
    }
    if (searchEngine !== engineToUse) {
      setSearchEngine(engineToUse);
    }

    const fetchRegularSearch = async () => {
      // Abort any previous in-flight request
  if (webSearchAbortRef.current) {
        try { webSearchAbortRef.current.abort(); } catch {}
      }
  webSearchAbortRef.current = new AbortController();
  const webSignal = webSearchAbortRef.current.signal;
      const doFetch = async (engine: string) => {
        try {
          // Get user preferences from localStorage
          const storedCountry = localStorage.getItem("searchCountry") || "ALL";
          const storedSafesearch = localStorage.getItem("safesearch") || "moderate";
          const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
          
          // Build query parameters
          const searchParams = new URLSearchParams({
            q: currentQuery,
            country: storedCountry,
            safesearch: storedSafesearch,
            ...(storedLang ? { lang: storedLang } : {})
          });
          
          const apiUrl = `${apiEndpoints.search.pars(engine)}?${searchParams}`;
          
          const response = await fetchWithSessionRefreshAndCache(
            apiUrl,
            { signal: webSignal },
            {
              searchType: 'search',
              provider: engine,
              query: currentQuery,
              searchParams: {
                  country: storedCountry,
                  safesearch: storedSafesearch,
                  ...(storedLang ? { lang: storedLang } : {})
                }
            }
          );
          if (!response.ok) throw new Error(`Search API request failed for ${engine} with query "${currentQuery}" and status ${response.status}`);
          const searchData = await response.json();
          if (isMounted && searchId === searchIdRef.current) {
            const resultsArray = searchData.results || [];
            setResults(resultsArray);
            // Capture videos cluster if present
            if (Array.isArray(searchData.videos)) {
              setVideoResults(searchData.videos);
            } else {
              setVideoResults([]);
            }
            // Capture news cluster if present (normalize to NewsResult[] shape)
            if (Array.isArray(searchData.news)) {
              try {
                const normalized = searchData.news.map((n: any) => ({
                  title: n.title || n.name || '',
                  description: n.description || n.snippet || '',
                  url: n.url || n.link || '',
                  source: n.meta_url?.netloc || n.source || '',
                  age: n.age || n.page_age || '',
                  thumbnail: n.thumbnail?.src || n.thumbnail?.original || undefined
                }));
                setNewsResults(normalized);
              } catch (e) {
                setNewsResults([]);
              }
            } else {
              setNewsResults([]);
            }
            setSearchEngine(engine); 
            // Mark that current results correspond to this query
            lastResultsQueryRef.current = currentQuery;
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

    fetchRegularSearch();

    return () => {
      isMounted = false;
      if (webSearchAbortRef.current) {
        try { webSearchAbortRef.current.abort(); } catch {}
        webSearchAbortRef.current = null;
      }
    };
  }, [searchParams, router, isAuthenticated, searchEngine, getEngineForMode]);

  useEffect(() => {
    if (!query || searchType !== 'images') return;
    setImageLoading(true);
    // Abort any previous images request
    if (imagesAbortRef.current) {
      try { imagesAbortRef.current.abort(); } catch {}
    }
    imagesAbortRef.current = new AbortController();
    const imgSignal = imagesAbortRef.current.signal;
    const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
    const imageEngine = getEngineForMode(searchEngine, 'images');
    const imagesUrl = `/api/images/${imageEngine}?q=${encodeURIComponent(query)}${storedLang ? `&lang=${storedLang}` : ''}`;
    fetchWithSessionRefreshAndCache(
      imagesUrl,
      { signal: imgSignal },
      {
        searchType: 'images',
        provider: imageEngine,
        query: query,
        searchParams: storedLang ? { lang: storedLang } : undefined
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error(`Image search failed with status ${response.status}`);
        return response.json();
      })
      .then(async (data) => {
        if (data.results) {
          // If cached result is empty, retry once with a cache-busting param
          if (Array.isArray(data.results) && data.results.length === 0 && !imageRetryRef.current) {
            imageRetryRef.current = true;
            try {
              // Abort previous controller and create a fresh one for retry
              if (imagesAbortRef.current) {
                try { imagesAbortRef.current.abort(); } catch {}
              }
              imagesAbortRef.current = new AbortController();
              const retrySignal = imagesAbortRef.current.signal;
              const retryUrl = `${imagesUrl}&_cb=${Date.now()}`;
              const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
              const retryRes = await fetchWithSessionRefreshAndCache(
                retryUrl,
                { signal: retrySignal },
                {
                  searchType: 'images',
                  provider: imageEngine,
                  query: query,
                  searchParams: { cacheBust: '1', ...(storedLang ? { lang: storedLang } : {}) }
                }
              );
              if (!retryRes.ok) throw new Error(`Image retry failed with status ${retryRes.status}`);
              const retryData = await retryRes.json();
              if (retryData.results) setImageResults(retryData.results);
            } catch (err) {
              console.error('Image retry failed:', err);
            } finally {
              setImageLoading(false);
            }
            return;
          }

          setImageResults(data.results);
          // Clear retry flag if we have real results
          imageRetryRef.current = false;
        }
      })
      .catch((error) => console.error("Image search failed:", error))
      .finally(() => {
        // If a retry is in progress, its own finally will update loading; avoid clobbering
        if (!imageRetryRef.current) setImageLoading(false);
      });
    return () => {
      if (imagesAbortRef.current) {
        try { imagesAbortRef.current.abort(); } catch {}
        imagesAbortRef.current = null;
      }
    };
  }, [query, searchEngine, searchType, getEngineForMode]);

  useEffect(() => {
    if (!query || searchType !== 'videos') return;
    setVideoLoading(true);

    // Abort any previous videos request
    if (videosAbortRef.current) {
      try { videosAbortRef.current.abort(); } catch {}
    }
    videosAbortRef.current = new AbortController();
    const vidSignal = videosAbortRef.current.signal;
    const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
    const videoEngine = getEngineForMode(searchEngine, 'videos');
    const videosUrl = `/api/videos/${videoEngine}?q=${encodeURIComponent(query)}${storedLang ? `&lang=${storedLang}` : ''}`;
    fetchWithSessionRefreshAndCache(
      videosUrl,
      { signal: vidSignal },
      {
        searchType: 'videos',
        provider: videoEngine,
        query: query,
        searchParams: storedLang ? { lang: storedLang } : undefined
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error(`Video search failed with status ${response.status}`);
        return response.json();
      })
      .then(async (data) => {
        if (data.results) {
          if (Array.isArray(data.results) && data.results.length === 0 && !videoRetryRef.current) {
            videoRetryRef.current = true;
            try {
              if (videosAbortRef.current) {
                try { videosAbortRef.current.abort(); } catch {}
              }
              videosAbortRef.current = new AbortController();
              const retrySignal = videosAbortRef.current.signal;
              const retryUrl = `${videosUrl}&_cb=${Date.now()}`;
              const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
              const retryRes = await fetchWithSessionRefreshAndCache(
                retryUrl,
                { signal: retrySignal },
                {
                  searchType: 'videos',
                  provider: videoEngine,
                  query: query,
                  searchParams: { cacheBust: '1', ...(storedLang ? { lang: storedLang } : {}) }
                }
              );
              if (!retryRes.ok) throw new Error(`Video retry failed with status ${retryRes.status}`);
              const retryData = await retryRes.json();
              if (retryData.results) setVideoResults(retryData.results);
            } catch (err) {
              console.error('Video retry failed:', err);
            } finally {
              setVideoLoading(false);
            }
            return;
          }

          setVideoResults(data.results);
          videoRetryRef.current = false;
        }
      })
      .catch((error) => console.error("Video search failed:", error))
      .finally(() => {
        if (!videoRetryRef.current) setVideoLoading(false);
      });

    return () => {
      if (videosAbortRef.current) {
        try { videosAbortRef.current.abort(); } catch {}
        videosAbortRef.current = null;
      }
    };
  }, [query, searchEngine, searchType, getEngineForMode]);

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
    
    if (newsAbortRef.current) {
      try { newsAbortRef.current.abort(); } catch {}
    }
    newsAbortRef.current = new AbortController();
    const newsSignal = newsAbortRef.current.signal;
    const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
    const newsEngine = getEngineForMode(searchEngine, 'news');
    const newsUrl = `/api/news/${newsEngine}?${searchParams}`;
    fetchWithSessionRefreshAndCache(
      newsUrl,
      { signal: newsSignal },
      {
        searchType: 'news',
        provider: newsEngine,
        query: query,
        searchParams: {
          country: storedCountry,
          safesearch: storedSafesearch,
          ...(storedLang ? { lang: storedLang } : {})
        }
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error(`News search failed with status ${response.status}`);
        return response.json();
      })
      .then(async (data) => {
        if (data.results) {
          // If cached result is empty, retry once with cache-bust
          if (Array.isArray(data.results) && data.results.length === 0 && !newsRetryRef.current) {
            newsRetryRef.current = true;
            try {
              if (newsAbortRef.current) {
                try { newsAbortRef.current.abort(); } catch {}
              }
              newsAbortRef.current = new AbortController();
              const retrySignal = newsAbortRef.current.signal;
              const retryUrl = `${newsUrl}&_cb=${Date.now()}`;
              const storedLang = localStorage.getItem('language') || navigator.language?.slice(0,2) || '';
              const retryRes = await fetchWithSessionRefreshAndCache(
                retryUrl,
                { signal: retrySignal },
                {
                  searchType: 'news',
                  provider: newsEngine,
                  query: query,
                  searchParams: { country: storedCountry, safesearch: storedSafesearch, cacheBust: '1', ...(storedLang ? { lang: storedLang } : {}) }
                }
              );
              if (!retryRes.ok) throw new Error(`News retry failed with status ${retryRes.status}`);
              const retryData = await retryRes.json();
              if (retryData.results) setNewsResults(retryData.results);
            } catch (err) {
              console.error('News retry failed:', err);
            } finally {
              setNewsLoading(false);
            }
            return;
          }

          setNewsResults(data.results);
          newsRetryRef.current = false;
        }
      })
      .catch((error) => console.error("News search failed:", error))
      .finally(() => {
        if (!newsRetryRef.current) setNewsLoading(false);
      });
    return () => {
      if (newsAbortRef.current) {
        try { newsAbortRef.current.abort(); } catch {}
        newsAbortRef.current = null;
      }
    };
  }, [query, searchEngine, searchType, getEngineForMode]);

  // Reset retry flags when query or engine changes so new queries can retry again
  useEffect(() => {
    imageRetryRef.current = false;
    newsRetryRef.current = false;
  }, [query, searchEngine]);

  useEffect(() => {
    if (!query || searchType !== 'images') return;

    if (imageResults.length === 0 && !imageLoading) {
      setImageLoading(true);
      if (imagesAbortRef.current) {
        try { imagesAbortRef.current.abort(); } catch {}
      }
      imagesAbortRef.current = new AbortController();
      const imgSignal = imagesAbortRef.current.signal;
      const imageEngine = getEngineForMode(searchEngine, 'images');
      fetchWithSessionRefreshAndCache(
        `/api/images/${imageEngine}?q=${encodeURIComponent(query)}`,
        { signal: imgSignal },
        {
          searchType: 'images',
          provider: imageEngine,
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
      return () => {
        if (imagesAbortRef.current) {
          try { imagesAbortRef.current.abort(); } catch {}
          imagesAbortRef.current = null;
        }
      };
    }
  }, [searchType, query, searchEngine, imageResults.length, imageLoading, getEngineForMode]);



  // Regular AI (Karakulak) — fire immediately in parallel when Dive mode is OFF
  useEffect(() => {
    if (!query) {
      aiRequestInProgressRef.current = null;
      if (aiAbortControllerRef.current) {
        try { aiAbortControllerRef.current.abort(); } catch {}
        aiAbortControllerRef.current = null;
      }
      return;
    }
    if (!aiEnabled || aiDiveEnabled) {
      return;
    }
    if (aiModel === undefined && localStorage.getItem("aiModel") !== null) {
      return;
    }

    const modelToUse = aiModel || "gemini";
    const requestKey = `${query}-ai-${modelToUse}`;
    if (aiRequestInProgressRef.current === requestKey) return;

    const isModelEnabled = (model: string) => {
      const stored = localStorage.getItem(`karakulakEnabled_${model}`);
      return stored !== "false";
    };

    const makeAIRequest = async (model: string, isRetry: boolean = false) => {
      try {
        const cachedResponse = SearchCache.getAI(model, query);
        if (cachedResponse) {
          setAiResponse(cachedResponse);
          setDiveResponse(null);
          setDiveSources([]);
          setAiLoading(false);
          setDiveLoading(false);
          setAiError(false);
          aiRequestInProgressRef.current = null;
          return;
        }

        aiRequestInProgressRef.current = requestKey;
        setAiLoading(true);
        setDiveLoading(false);
        setAiError(false);
        if (aiAbortControllerRef.current) {
          try { aiAbortControllerRef.current.abort(); } catch {}
        }
        aiAbortControllerRef.current = new AbortController();
        const res = await fetchWithSessionRefreshAndCache(`/api/karakulak/${model}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: query }),
          signal: aiAbortControllerRef.current.signal
        }, {
          searchType: 'ai',
          provider: model,
          query,
          searchParams: {}
        });

        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`);
        }

        const aiData = await res.json();
        const aiResult = (aiData.answer || '').trim();
        setAiResponse(aiResult);
        setDiveResponse(null);
        setDiveSources([]);
        SearchCache.setAI(model, query, aiResult);

  setAiLoading(false);
  setDiveLoading(false);
  setAiError(false);
  aiRequestInProgressRef.current = null;
  aiAbortControllerRef.current = null;
      } catch (error) {
        console.error(`AI response failed for model ${model}:`, error);
        if (!isRetry && model !== "gemini" && !aiModel && !aiDiveEnabled) {
          makeAIRequest("gemini", true);
        } else {
          setAiLoading(false);
          setDiveLoading(false);
          setAiError(true);
          aiRequestInProgressRef.current = null;
          aiAbortControllerRef.current = null;
        }
      }
    };

    if (isModelEnabled(modelToUse)) {
      makeAIRequest(modelToUse);
    } else {
      aiRequestInProgressRef.current = null;
    }

    return () => {
      if (aiAbortControllerRef.current) {
        try { aiAbortControllerRef.current.abort(); } catch {}
        aiAbortControllerRef.current = null;
      }
    };
  }, [query, aiEnabled, aiModel, aiDiveEnabled]);

  // Dive Mode — wait for web results to arrive, then send Dive request in parallel
  useEffect(() => {
    if (!query) {
      aiRequestInProgressRef.current = null;
      if (aiAbortControllerRef.current) {
        try { aiAbortControllerRef.current.abort(); } catch {}
        aiAbortControllerRef.current = null;
      }
      return;
    }
    if (!aiEnabled || !aiDiveEnabled) {
      return;
    }

    const searchId = searchIdRef.current;
    const requestKey = `${query}-dive`;
    if (aiRequestInProgressRef.current === requestKey) return;

    // If cached, use immediately
    const cachedDiveResponse = SearchCache.getDive(query);
    if (cachedDiveResponse) {
      setDiveResponse(cachedDiveResponse.response);
      setDiveSources(cachedDiveResponse.sources || []);
      setDiveLoading(false);
      setAiResponse(null);
      setAiLoading(false);
      aiRequestInProgressRef.current = null;
      return;
    }

    const hasFreshResults = results.length > 0 && lastResultsQueryRef.current === query;
    if (!hasFreshResults) {
      setDiveLoading(true);
      return;
    }

    const candidateResults = results.slice(0, 8).map((r: any) => ({
      url: r.url,
      title: r.title,
      snippet: r.description
    }));

  const makeDiveRequest = async () => {
      try {
        aiRequestInProgressRef.current = requestKey;
        setDiveLoading(true);
        setAiLoading(false);
    setDiveError(false);
        if (aiAbortControllerRef.current) {
          try { aiAbortControllerRef.current.abort(); } catch {}
        }
        aiAbortControllerRef.current = new AbortController();
        const diveResponse = await fetchWithSessionRefreshAndCache('/api/dive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, pages: candidateResults }),
          signal: aiAbortControllerRef.current.signal
        }, {
          searchType: 'dive',
          provider: 'dive',
          query,
          searchParams: { candidates: String(candidateResults.length) }
        });

        if (!diveResponse.ok) {
          throw new Error(`Dive API failed with status ${diveResponse.status}`);
        }

        const diveData = await diveResponse.json();
        if (searchId === searchIdRef.current) {
          setDiveResponse(diveData.response);
          setDiveSources(diveData.sources || []);
          setAiResponse(null);
          SearchCache.setDive(query, diveData.response, diveData.sources || []);
          setDiveError(false);
        } else {
          console.log(`Search ID changed, ignoring stale dive response for query: "${query}"`);
        }

  setDiveLoading(false);
  setAiLoading(false);
        aiRequestInProgressRef.current = null;
        aiAbortControllerRef.current = null;
      } catch (error) {
        console.error('Dive request failed:', error);
        setDiveLoading(false);
        setAiLoading(false);
        setDiveError(true);
        aiRequestInProgressRef.current = null;
        aiAbortControllerRef.current = null;
      }
    };

    makeDiveRequest();

    return () => {
      if (aiAbortControllerRef.current) {
        try { aiAbortControllerRef.current.abort(); } catch {}
        aiAbortControllerRef.current = null;
      }
    };
  }, [query, aiEnabled, aiDiveEnabled, results]);

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
    // Abort in-flight AI/Dive request when toggling mode
    if (aiAbortControllerRef.current) {
      try { aiAbortControllerRef.current.abort(); } catch {}
      aiAbortControllerRef.current = null;
    }
    setAiDiveEnabled(prevAiDiveEnabled => {
      const next = !prevAiDiveEnabled;
      if (aiEnabled) {
        if (next) {
          // Switching to Dive mode - check for cached data first
          const cachedDiveResponse = SearchCache.getDive(query);
          if (cachedDiveResponse) {
            // If cached data exists, set it immediately without clearing current text
            setDiveResponse(cachedDiveResponse.response);
            setDiveSources(cachedDiveResponse.sources || []);
            setAiResponse(null);
            setDiveLoading(false);
            setAiLoading(false);
          } else {
            // No cached data - clear and show loading
            setAiResponse(null);
            setDiveResponse(null);
            setDiveSources([]);
          }
        } else {
          // Switching to AI mode - check for cached data first
          const cachedAIResponse = SearchCache.getAI(aiModel || "gemini", query);
          if (cachedAIResponse) {
            // If cached data exists, set it immediately without clearing current text
            setAiResponse(cachedAIResponse);
            setDiveResponse(null);
            setDiveSources([]);
            setAiLoading(false);
            setDiveLoading(false);
          } else {
            // No cached data - clear and show loading
            setAiResponse(null);
            setDiveResponse(null);
            setDiveSources([]);
          }
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchInput.trim().length < 2) {
        setSuggestions([]);
        return;
      }
  // Include user settings (country, safesearch, lang) in the cache key so
  // suggestions are scoped to these preferences. Use query-string style so
  // keys look like: autocomplete-brave-pornhub?country=ALL&lang=en&safesearch=off
  const country = (typeof window !== 'undefined' && localStorage.getItem('searchCountry')) || 'ALL';
  const safesearch = (typeof window !== 'undefined' && localStorage.getItem('safesearch')) || 'moderate';
  const lang = (typeof window !== 'undefined' && (localStorage.getItem('language') || navigator.language?.slice(0,2))) || '';
  const baseKey = `autocomplete-${autocompleteSource}-${searchInput.trim().toLowerCase()}`;
  const _paramsForKey = new URLSearchParams();
  // ensure requested order: country, lang, safesearch
  _paramsForKey.set('country', country);
  if (lang) _paramsForKey.set('lang', lang);
  _paramsForKey.set('safesearch', safesearch);
  const cacheKey = `${baseKey}?${_paramsForKey.toString()}`;
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
      if (!(window as any).__autocompleteRetryMap) (window as any).__autocompleteRetryMap = {};
      const retryMap: Record<string, boolean> = (window as any).__autocompleteRetryMap;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSuggestions(parsed);
            return;
          }
          if (Array.isArray(parsed) && parsed.length === 0 && retryMap[cacheKey]) {
            setSuggestions([]);
            return;
          }
          // else fallthrough to fetch
        } catch (e) {
          // parsing error -> fallthrough
        }
      }

      try {
        if (suggestionsAbortRef.current) {
          try { suggestionsAbortRef.current.abort(); } catch {}
        }
        suggestionsAbortRef.current = new AbortController();
        const sugSignal = suggestionsAbortRef.current.signal;

        const fetchSuggestionsForLang = async (langParam?: string) => {
          const params = new URLSearchParams();
          params.set('q', searchInput);
          if (country) params.set('country', country);
          if (safesearch) params.set('safesearch', safesearch);
          if (langParam) params.set('lang', langParam);
          const response = await fetchWithSessionRefreshAndCache(`/api/autocomplete/${autocompleteSource}?${params.toString()}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: sugSignal,
          });
          if (!response.ok) throw new Error(`Autocomplete fetch failed with status ${response.status}`);
          const data = await response.json();

          if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
            return data[1].map((suggestion) => ({ query: suggestion }));
          }

          console.warn('Unexpected suggestion format:', data);
          return [] as Suggestion[];
        };

        let processedSuggestions: Suggestion[] = [];

        try {
          processedSuggestions = await fetchSuggestionsForLang(lang || undefined);
        } catch (primaryError) {
          console.error('Failed to fetch suggestions for current language:', primaryError);
        }

        if (processedSuggestions.length === 0 && lang && lang.toLowerCase() !== 'en') {
          try {
            const fallbackSuggestions = await fetchSuggestionsForLang('en');
            if (fallbackSuggestions.length > 0) {
              processedSuggestions = fallbackSuggestions;
            }
          } catch (fallbackError) {
            console.error('Fallback autocomplete fetch failed:', fallbackError);
          }
        }

        setSuggestions(processedSuggestions);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(processedSuggestions)); } catch {}

        if (processedSuggestions.length === 0) {
          retryMap[cacheKey] = true;
        } else if (retryMap[cacheKey]) {
          delete retryMap[cacheKey];
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 200);
    return () => {
      clearTimeout(timeoutId);
      if (suggestionsAbortRef.current) {
        try { suggestionsAbortRef.current.abort(); } catch {}
        suggestionsAbortRef.current = null;
      }
    };
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

  useEffect(() => {
    if (query) {
      document.title = `${query} - Tekir`;
    } else {
      document.title = "Tekir";
    }
  }, [query]);

  useEffect(() => {
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const start = 120;
        const span = 220;
        const raw = Math.min(1, Math.max(0, (y - start) / span));
        const eased = easeOutCubic(raw);
        setScrollProgress(eased);
        setIsScrolled(y > start);
        rafId = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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
        
        // Check cache first
        const cachedWikiData = SearchCache.getWikipedia(query, browserLanguage);
        if (cachedWikiData) {
          console.log('Wikipedia cache hit for:', query);
          setWikiData(cachedWikiData);
          setWikiLoading(false);
          return;
        }

        // Abort any in-flight Wikipedia requests
        if (wikipediaAbortRef.current) {
          try { wikipediaAbortRef.current.abort(); } catch {}
        }
        wikipediaAbortRef.current = new AbortController();
        const wikiSignal = wikipediaAbortRef.current.signal;
        
        // Build Wikipedia suggestion API URL with priority parameters
        const suggestionUrl = new URL(`/api/suggest/wikipedia`, window.location.origin);
        suggestionUrl.searchParams.set('q', query);
        
        if (browserLanguage) {
          suggestionUrl.searchParams.set('lang', browserLanguage);
        }
        
        if (searchCountry) {
          suggestionUrl.searchParams.set('country', searchCountry);
        }

  const suggestionResponse = await fetchWithSessionRefreshAndCache(suggestionUrl.toString(), { signal: wikiSignal });
        
        if (!suggestionResponse.ok) {
          throw new Error(`Wikipedia suggestion API failed: ${suggestionResponse.status}`);
        }
        
        const suggestionData = await suggestionResponse.json();
        
        const articleTitle = suggestionData.article;
        const language = suggestionData.language || 'en';

        if (articleTitle) {
          const detailsUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`;
          const detailsResponse = await fetch(detailsUrl, { signal: wikiSignal });
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

            // Cache the successful result
            SearchCache.setWikipedia(query, wikipediaData, browserLanguage);
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

    const searchResponse = await fetch(searchUrl, { signal: wikipediaAbortRef.current?.signal });
        const searchData = await searchResponse.json();

        if (searchData.query?.search?.length > 0) {
          const topResult = searchData.query.search[0];
          const pageTitle = topResult.title;

          const detailsUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
          const detailsResponse = await fetch(detailsUrl, { signal: wikipediaAbortRef.current?.signal });
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

            // Cache the fallback result as well
            const browserLanguage = navigator.language?.slice(0, 2);
            SearchCache.setWikipedia(query, wikipediaData, browserLanguage);
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
      // Check if Wikipedia is enabled in settings before fetching
      if (settings.wikipediaEnabled !== false) {
        fetchWikipediaData();
      } else {
        setWikiData(null);
      }
    } else {
      setWikiData(null);
    }

    return () => {
      if (wikipediaAbortRef.current) {
        try { wikipediaAbortRef.current.abort(); } catch {}
        wikipediaAbortRef.current = null;
      }
    };
  }, [query, hasBang, settings.wikipediaEnabled]);

  useEffect(() => {
    const storedSearchType = localStorage.getItem("searchType");
    if (storedSearchType === 'web' || storedSearchType === 'images' || storedSearchType === 'news' || storedSearchType === 'videos') {
      setSearchType(storedSearchType as 'web' | 'images' | 'news' | 'videos');
    }
  }, []);

  const handleSearchTypeChange = (type: 'web' | 'images' | 'news' | 'videos') => {
    // Immediately clear stale results and show loading skeletons so the UI
    // doesn't flash a "No results" state while the fetch starts.
    if (type === 'images') {
      // clear previous images and show skeleton if we have a query
      setImageResults([]);
      if (imagesAbortRef.current) {
        try { imagesAbortRef.current.abort(); } catch {}
        imagesAbortRef.current = null;
      }
      if (query) setImageLoading(true);
    } else {
      // turning off images tab
      setImageLoading(false);
    }

    if (type === 'news') {
      // clear previous news and show skeleton if we have a query
      setNewsResults([]);
      if (newsAbortRef.current) {
        try { newsAbortRef.current.abort(); } catch {}
        newsAbortRef.current = null;
      }
      if (query) setNewsLoading(true);
    } else {
      setNewsLoading(false);
    }

    if (type === 'videos') {
      // clear previous videos and show skeleton if we have a query
      setVideoResults([]);
      if (videosAbortRef.current) {
        try { videosAbortRef.current.abort(); } catch {}
        videosAbortRef.current = null;
      }
      if (query) setVideoLoading(true);
    } else {
      setVideoLoading(false);
    }

    setSearchType(type);
    localStorage.setItem("searchType", type);

    // Note: the existing useEffect hooks (watching searchType/query) will
    // perform the actual fetch. We only prepare UI state here so skeletons
    // render immediately when the user switches tabs.
  };

  const [isNewsInlineOpen, setIsNewsInlineOpen] = useState(true);
  const [isNewsBottomOpen, setIsNewsBottomOpen] = useState(true);
  const [isVideosInlineOpen, setIsVideosInlineOpen] = useState(true);
  const [isVideosBottomOpen, setIsVideosBottomOpen] = useState(true);

  // Easter egg: show flying cats when query contains "cat" in common languages
  const catEasterEgg = (() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return false;
    const tokens = q.split(/\W+/).filter(Boolean);
    const words = new Set(["cat", "cats", "kedi", "katze", "gatto"]);
    return tokens.some((t) => words.has(t));
  })();

  // Get the selected logo from localStorage immediately (before any React rendering)
  // This ensures the correct logo loads without flashing the default
  const [selectedLogoState, setSelectedLogoState] = useState<'tekir' | 'duman' | 'pamuk' | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Load logo from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('selectedLogo');
    if (stored === 'tekir' || stored === 'duman' || stored === 'pamuk') {
      setSelectedLogoState(stored);
    } else {
      setSelectedLogoState('tekir');
    }
    setLogoLoaded(true);
  }, []);

  // Update logo state when settings change
  useEffect(() => {
    if (settings.selectedLogo && settings.selectedLogo !== selectedLogoState) {
      setSelectedLogoState(settings.selectedLogo);
      // Ensure it's saved to localStorage for next load
      localStorage.setItem('selectedLogo', settings.selectedLogo);
    }
  }, [settings.selectedLogo, selectedLogoState]);

  const logoMetadata = selectedLogoState ? getLogoMetadata(selectedLogoState) : getLogoMetadata('tekir');

  // Helper to normalize thumbnail values which may be a string or an object
  const resolveImageSrc = (t: any): string | null => {
    if (!t) return null;
    if (typeof t === 'string') return t;
    if (t.src) return t.src;
  if (t.source) return t.source;
    if (t.original) return t.original;
    return null;
  };

  // Precompute whether the Karakulak box should be shown to simplify JSX
  const showKarakulak = (() => {
    if (searchType !== 'web' || !aiEnabled) return false;
    const hasSomething = !!(aiResponse || diveResponse || aiLoading || diveLoading);
    if (!hasSomething) return false;
    if (aiLoading || diveLoading) return true;
    const activeResponse = diveResponse || aiResponse;
    return !shouldHideKarakulak(activeResponse);
  })();

  // Render the main results area. Extracted to avoid large nested JSX/ternaries
  const renderResultsArea = () => {
    if (searchType === 'web') {
      if (loading) {
        return (
          <div className="space-y-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        );
      }

      if (results.length > 0) {
        return (
          <div className="space-y-8">
            {results.map((result, index) => (
              <div key={`result-${index}`}>
                <WebResultItem result={result as any} />

                {/* Insert News cluster after 4th result (index 3) */}
                {index === 3 && settings.enchantedResults !== false && newsResults && newsResults.length > 0 && (
                  <div className="mt-8 mb-8">
                    <button
                      onClick={() => setIsNewsInlineOpen(v => !v)}
                      className="w-full text-left flex items-center justify-between"
                      aria-expanded={isNewsInlineOpen}
                      aria-controls="news-inline-cluster"
                    >
                      <div className="flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm mb-0 font-medium text-muted-foreground">News</h3>
                      </div>
                      <ChevronDown className={`ml-2 transform transition-transform duration-200 ${isNewsInlineOpen ? 'rotate-180' : 'rotate-0'}`} />
                    </button>
                    {!isNewsInlineOpen && (
                      <p className="text-xs text-muted-foreground mt-2">{t('search.newsClusterDescription')}</p>
                    )}
                    {isNewsInlineOpen && (
                      <div className="relative mt-4 mb-4 blurry-outline cluster-enter">
                        <div className="relative">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {newsResults.slice(0, 4).map((article, idx) => (
                              <a key={`news-${idx}`} href={article.url || '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group hover:shadow-md p-2 rounded-lg bg-card border border-border transition-colors">
                                <div className="w-28 h-16 flex-shrink-0 overflow-hidden rounded-md bg-muted relative">
                                  {resolveImageSrc(article.thumbnail) ? (
                                    <Image src={resolveImageSrc(article.thumbnail)!} alt={article.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="112px" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <Newspaper className="w-6 h-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{article.title}</h4>
                                  {article.description && <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>}
                                  <div className="text-xs text-muted-foreground mt-2">{(article.source || '')}{article.age ? ` • ${article.age}` : ''}</div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Insert Videos cluster after 9th result (index 8) */}
                {index === 8 && settings.enchantedResults !== false && videoResults && videoResults.length > 0 && (
                  <div className="mt-8 mb-8 blurry-outline">
                    <button
                      onClick={() => setIsVideosInlineOpen(v => !v)}
                      className="w-full text-left flex items-center justify-between"
                      aria-expanded={isVideosInlineOpen}
                      aria-controls="videos-inline-cluster"
                    >
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm text-muted-foreground mb-0 font-medium">Videos</h3>
                      </div>
                      <ChevronDown className={`ml-2 transform transition-transform duration-200 ${isVideosInlineOpen ? 'rotate-180' : 'rotate-0'}`} />
                    </button>
                    {!isVideosInlineOpen && (
                      <p className="text-xs text-muted-foreground mt-2">{t('search.videosClusterDescription')}</p>
                    )}
                    {isVideosInlineOpen && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4 cluster-enter">
                        {videoResults.slice(0, 4).map((v, idx) => (
                          <a key={`video-${idx}`} href={v.url || v.content_url || '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group hover:shadow-md p-2 rounded-lg bg-card border border-border transition-colors">
                            <div className="w-32 h-20 flex-shrink-0 overflow-hidden rounded-md bg-muted relative">
                              {resolveImageSrc(v.thumbnail) ? (
                                <Image src={resolveImageSrc(v.thumbnail)!} alt={v.title || t('search.videoFallback')} fill className="object-cover group-hover:scale-105 transition-transform" sizes="128px" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Search className="w-6 h-6" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{v.title || v.name}</h4>
                              {v.description && <p className="text-sm text-muted-foreground line-clamp-2">{v.description}</p>}
                              <div className="text-xs text-muted-foreground mt-2">{v.site || v.source || ''}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* If results are short, keep the clusters at the bottom as a fallback */}
            {results.length <= 3 && settings.enchantedResults !== false && newsResults && newsResults.length > 0 && (
              <div className="mt-8 mb-8">
                <button
                  onClick={() => setIsNewsBottomOpen(v => !v)}
                  className="w-full text-left flex items-center justify-between"
                  aria-expanded={isNewsBottomOpen}
                  aria-controls="news-bottom-cluster"
                >
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm text-muted-foreground mb-0 font-medium">News</h3>
                  </div>
                  <ChevronDown className={`ml-2 transform transition-transform duration-200 ${isNewsBottomOpen ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                {!isNewsBottomOpen && (
                  <p className="text-xs text-muted-foreground mt-2">{t('search.newsClusterDescription')}</p>
                )}
                {isNewsBottomOpen && (
                  <div className="relative mt-4 mb-4 blurry-outline cluster-enter">
                    <div className="absolute -inset-x-4 -top-3 h-1 bg-blue-500 rounded-sm opacity-80" />
                    <div className="absolute -inset-x-4 -bottom-3 h-1 bg-blue-500 rounded-sm opacity-80" />
                    <div className="absolute -left-3 -inset-y-3 w-1 bg-blue-500 rounded-sm opacity-80" />
                    <div className="absolute -right-3 -inset-y-3 w-1 bg-blue-500 rounded-sm opacity-80" />
                    <div className="relative">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {newsResults.slice(0, 4).map((article, idx) => (
                          <a key={`news-bottom-${idx}`} href={article.url || '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group hover:shadow-md p-2 rounded-lg bg-card border border-border transition-colors">
                            <div className="w-28 h-16 flex-shrink-0 overflow-hidden rounded-md bg-muted relative">
                              {resolveImageSrc(article.thumbnail) ? (
                                <Image src={resolveImageSrc(article.thumbnail)!} alt={article.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="112px" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Newspaper className="w-6 h-6" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{article.title}</h4>
                              {article.description && <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>}
                              <div className="text-xs text-muted-foreground mt-2">{(article.source || '')}{article.age ? ` • ${article.age}` : ''}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {results.length <= 8 && settings.enchantedResults !== false && videoResults && videoResults.length > 0 && (
              <div className="mt-8 mb-8 blurry-outline">
                <button
                  onClick={() => setIsVideosBottomOpen(v => !v)}
                  className="w-full text-left flex items-center justify-between"
                  aria-expanded={isVideosBottomOpen}
                  aria-controls="videos-bottom-cluster"
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm text-muted-foreground mb-0 font-medium">Videos</h3>
                  </div>
                  <ChevronDown className={`ml-2 transform transition-transform duration-200 ${isVideosBottomOpen ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                {!isVideosBottomOpen && (
                  <p className="text-xs text-muted-foreground mt-2">{t('search.videosClusterDescription')}</p>
                )}
                {isVideosBottomOpen && (
                  <div className="relative mt-4 mb-4 cluster-enter">
                    <div className="absolute -inset-x-4 -top-3 h-1 bg-purple-500 rounded-sm opacity-80" />
                    <div className="absolute -inset-x-4 -bottom-3 h-1 bg-purple-500 rounded-sm opacity-80" />
                    <div className="absolute -left-3 -inset-y-3 w-1 bg-purple-500 rounded-sm opacity-80" />
                    <div className="absolute -right-3 -inset-y-3 w-1 bg-purple-500 rounded-sm opacity-80" />
                    <div className="relative">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {videoResults.slice(0, 4).map((v, idx) => (
                          <a key={`video-bottom-${idx}`} href={v.url || v.content_url || '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group hover:shadow-md p-2 rounded-lg bg-card border border-border transition-colors">
                            <div className="w-32 h-20 flex-shrink-0 overflow-hidden rounded-md bg-muted relative">
                              {resolveImageSrc(v.thumbnail) ? (
                                <Image src={resolveImageSrc(v.thumbnail)!} alt={v.title || t('search.videoFallback')} fill className="object-cover group-hover:scale-105 transition-transform" sizes="128px" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Search className="w-6 h-6" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{v.title || v.name}</h4>
                              {v.description && <p className="text-sm text-muted-foreground line-clamp-2">{v.description}</p>}
                              <div className="text-xs text-muted-foreground mt-2">{v.site || v.source || ''}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        );
      }

      // no results case
      if (query) {
        return <div className="text-center text-muted-foreground">{t('search.noResults', { query })}</div>;
      }
      return <div className="text-center text-muted-foreground">{t('search.enterSearchTerm')}</div>;
    }

  if (searchType === 'images') {
      if (imageLoading) {
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-muted rounded-lg w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4 mt-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mt-1"></div>
              </div>
            ))}
          </div>
        );
      }

      if (imageResults.length > 0) {
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {imageResults.map((image, index) => (
              <a key={index} href={image.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden blurry-outline">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-muted mb-3">
                  <Image src={image.thumbnail.src} alt={image.title || t('search.imageAlt')} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-300 group-hover:scale-105" placeholder="blur" blurDataURL={image.properties.placeholder || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDUwMCA1MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwMCIgaGVpZ2h0PSI1MDAiIGZpbGw9IiNFNkU2RTYiLz48L3N2Zz4="} />
                </div>
                <p className="text-sm font-medium truncate">{image.title || t('search.imageFallback')}</p>
                <p className="text-xs text-muted-foreground truncate">{image.source}</p>
              </a>
            ))}
          </div>
        );
      }

      return <div className="text-center text-muted-foreground">{t('images.noImagesFound', { query })}</div>;
    }

    if (searchType === 'news') {
      if (newsLoading) {
        return (
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
        );
      }

      if (newsResults.length > 0) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {newsResults.map((article, index) => (
              <div key={index} className="border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 bg-card">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group h-full">
                  <div className="relative w-full h-48 bg-muted">
                    {resolveImageSrc(article.thumbnail) ? (
                      <div className="relative w-full h-full">
                        <Image src={resolveImageSrc(article.thumbnail)!} alt={article.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-200" onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.parentElement?.querySelector('.image-placeholder');
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }} />
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
                    <div className="flex items-center gap-2 mb-2">
                      {settings.showFavicons && article.favicon && (
                        <Image src={article.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
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
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2 mb-2 leading-tight">{article.title}</h2>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-2 flex-grow">{(() => {
                      const words = article.description.split(' ');
                      if (words.length <= 14) {
                        return article.description + '...';
                      }
                      return words.slice(0, 14).join(' ') + '...';
                    })()}</p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        );
      }

      return <div className="text-center text-muted-foreground">{t('news.noNewsFound', { query })}</div>;
    }

    if (searchType === 'videos') {
      if (videoLoading) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse border border-border rounded-lg overflow-hidden bg-card">
                <div className="w-full h-48 bg-muted"></div>
                <div className="p-4">
                  <div className="h-5 bg-muted rounded w-4/5 mb-2"></div>
                  <div className="h-5 bg-muted rounded w-3/5 mb-4"></div>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                </div>
              </div>
            ))}
          </div>
        );
      }

      if (videoResults.length > 0) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {videoResults.map((v, index) => (
              <a key={index} href={v.url || v.content_url || '#'} target="_blank" rel="noopener noreferrer" className="group overflow-hidden blurry-outline border border-border rounded-lg p-2 bg-card hover:shadow-lg transition-all">
                <div className="relative w-full h-48 bg-muted rounded-md overflow-hidden mb-3">
                  {resolveImageSrc(v.thumbnail) ? (
                    <Image src={resolveImageSrc(v.thumbnail)!} alt={v.title || t('search.videoFallback')} fill className="object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Search className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{v.title || v.name}</h4>
                {v.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{v.description}</p>}
                <div className="text-xs text-muted-foreground">{v.site || v.source || ''}</div>
              </a>
            ))}
          </div>
        );
      }

      return <div className="text-center text-muted-foreground">{t('videos.noVideosFound', { query })}</div>;
    }

    return null;
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/70"
        style={{
          opacity: scrollProgress,
          transform: `translateY(${(-8) * (1 - scrollProgress)}px)`,
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
          pointerEvents: scrollProgress > 0.1 ? "auto" : "none",
        }}
        aria-hidden={scrollProgress < 0.05}
      >
        <div className="container mx-auto flex items-center gap-4 h-14 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {logoLoaded ? (
              <Image key={logoMetadata.path} src={logoMetadata.path} alt={t('search.logoAlt')} width={36} height={12} style={{ transform: `scale(1)`, transition: "transform 150ms ease-out" }} suppressHydrationWarning />
            ) : (
              <div style={{ width: 36, height: 12 }} className="bg-transparent" />
            )}
            <span className="sr-only">Tekir</span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative">
            <div className="relative">
              <SearchInput
                type="text"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t('search.placeholder')}
                className="w-full pr-12 h-10"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button type="submit" variant="ghost" size="icon" shape="pill" title="Search">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Autocomplete dropdown tied to the header input */}
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="absolute w-full mt-2 py-2 bg-background rounded-lg border border-border shadow-lg z-50">
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
          </form>

          <div className="flex items-center gap-3 ml-auto">
            <UserProfile avatarSize={36} />
          </div>
        </div>
      </header>

  <div className="min-h-screen flex flex-col">
      <main className="p-4 md:p-8 flex-grow">
  {/* Flying Cats Easter Egg overlay */}
  <FlyingCats show={!!catEasterEgg} />
        <div className="max-w-5xl w-full md:w-4/5 xl:w-2/3 ml-0 md:ml-8 md:mr-8 mb-8 relative">
          <form onSubmit={handleSearch} className="flex items-center w-full space-x-2 md:space-x-4">
            <Link href="/">
              {logoLoaded ? (
                <Image key={logoMetadata.path} src={logoMetadata.path} alt="Tekir Logo" width={40} height={40} priority suppressHydrationWarning />
              ) : (
                <div style={{ width: 40, height: 40 }} className="bg-transparent" />
              )}
            </Link>
            <div className="relative flex-1 min-w-0">
              <div className="flex items-center w-full relative">
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t('search.placeholder')}
                maxLength={800}
                className="flex-1 px-4 py-2 pr-16 rounded-full shadow-lg text-lg"
                style={{ minWidth: 0 }}
              />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              <Button type="submit" variant="ghost" size="icon" shape="pill" title="Search">
                <Search className="w-5 h-5" />
              </Button>
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
            <div className="hidden md:flex items-center gap-4 ml-auto">
              <UserProfile mobileNavItems={mobileNavItems} />
            </div>
            <div className="md:hidden">
              <UserProfile mobileNavItems={mobileNavItems} />
            </div>
          </form>

        </div>

        <div className="max-w-6xl w-full md:ml-8 md:mr-8 relative">
          {query && (
            <div className="mb-6 border-b border-border">
              <SearchTabs active={searchType} onChange={handleSearchTypeChange} />
            </div>
          )}

          <div className="flex flex-col md:flex-row md:gap-6 lg:gap-8">
            <div className="flex-1 md:w-2/3 lg:w-3/4 xl:w-2/3 2xl:w-3/4">
              {/* Standalone AI/Dive error banner */}
                {(searchType === 'web' && aiEnabled && (aiError || diveError)) ? (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-md border border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 text-sm flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{t('search.karakulakError')}</span>
                  <button 
                  onClick={() => {
                    setAiError(false);
                    setDiveError(false);
                  }}
                  className="ml-auto text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
                  aria-label="Dismiss error"
                  >
                  <X className="w-4 h-4" />
                  </button>
                </div>
                ) : null}
              {showKarakulak ? (
                <div className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                        {t('search.karakulakName')}
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                          {t('search.betaLabel')}
                        </span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleAiDive}
                        className={`relative p-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center overflow-hidden ${
                          aiDiveEnabled 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 ring-2 ring-blue-400 ring-offset-2 ring-offset-background' 
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md'
                        }`}
                        title={aiDiveEnabled ? "Disable Dive mode" : "Enable Dive mode"}
                      >
                        <Sparkles className={`w-5 h-5 transition-all duration-300 relative z-10 ${aiDiveEnabled ? 'drop-shadow-lg' : 'hover:scale-110'}`} />
                        {aiDiveEnabled && (
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 via-blue-300/30 to-blue-400/20 animate-pulse"></div>
                        )}
                      </button>

                      <button
                        onClick={() => setKarakulakCollapsed(prev => !prev)}
                        aria-expanded={!karakulakCollapsed}
                        title={karakulakCollapsed ? 'Expand Karakulak' : 'Collapse Karakulak'}
                        className="px-2 py-1 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${karakulakCollapsed ? 'rotate-180' : ''}`} />
                        <span className="sr-only">{karakulakCollapsed ? 'Expand' : 'Collapse'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {(aiLoading || diveLoading) ? (
                    <div className="animate-pulse space-y-2">
                      <div className="flex items-center gap-2 text-xs text-blue-600/70 dark:text-blue-300/70">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                        <span>{aiDiveEnabled ? t('search.fetchingWebSources') : t('search.processingRequest')}</span>
                      </div>
                      <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-1/2 mb-3"></div>
                    </div>
                  ) : (
                    <>
                      <p className={`text-left text-blue-800 dark:text-blue-100 mb-3 ${karakulakCollapsed ? 'line-clamp-2' : ''}`}>
                        {diveResponse || aiResponse}
                      </p>

                      <div
                        className="overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
                        style={{ maxHeight: karakulakCollapsed ? 0 : 1000, opacity: karakulakCollapsed ? 0 : 1, transform: karakulakCollapsed ? 'translateY(-6px)' : 'translateY(0px)' }}
                        aria-hidden={karakulakCollapsed}
                      >
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

                        {(diveResponse || aiResponse) ? (
                          <p className="text-sm text-blue-600/70 dark:text-blue-300/70 mb-4">
                            {aiDiveEnabled 
                              ? "Generated from web sources. May contain inaccuracies." 
                              : "Auto-generated based on AI knowledge. May contain inaccuracies."
                            }
                          </p>
                        ) : null}

                      </div>
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
                              {/* Mobile expanded WikiNotebook */}
                              <div>
                                <WikiNotebook wikiData={wikiData} />
                              </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {renderResultsArea()}
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
                  <div>
                    <WikiNotebook wikiData={wikiData} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer variant="minimal" />
      <FloatingFeedback
        query={query}
        results={results}
        wikiData={wikiData}
        suggestions={suggestions}
        aiResponse={aiResponse || diveResponse}
        searchEngine={searchEngine}
        searchType={searchType}
      />
    </div>
    </>
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