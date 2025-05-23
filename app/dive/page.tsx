"use client";

import { useEffect, useState, Suspense, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, ExternalLink, ArrowRight, Loader2, AlertTriangle, Zap, MessageCircleMore } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message"; 
import { ThemeToggle } from "@/components/theme-toggle";

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

interface SearchResultItem {
  url: string;
  title: string;
  description?: string; // Snippet from Brave search
  source?: string; // Added for consistency if needed
}

interface DiveApiResponse {
  response: string;
  sources: SearchResultItem[];
}

function DivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get("q");

  const [query, setQuery] = useState(queryParam || "");
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [sources, setSources] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [currentSearchInput, setCurrentSearchInput] = useState(queryParam || "");

  const fetchDiveData = useCallback(async (currentQuery: string, signal: AbortSignal) => {
    if (!currentQuery) return;

    setIsLoading(true);
    setError(null);
    setLlmResponse(null);
    setSources([]);

    try {
      // Step 1: Fetch search results from Brave
      const braveSearchUrl = `/api/pars/brave?q=${encodeURIComponent(currentQuery)}`;
      const braveResponse = await fetchWithSessionRefresh(braveSearchUrl, { signal });
      if (signal.aborted) return;

      if (!braveResponse.ok) {
        throw new Error(`Failed to fetch search results: ${braveResponse.statusText}`);
      }
      const braveResults: SearchResultItem[] = await braveResponse.json();
      if (signal.aborted) return;

      if (!braveResults || braveResults.length === 0) {
        throw new Error("No search results found to dive into.");
      }

      const top2results = braveResults.slice(0, 2).map(r => ({
        url: r.url,
        title: r.title,
        snippet: r.description // Assuming description is the snippet
      }));

      // Step 2: Call /api/dive with query and page URLs/metadata
      const diveApiUrl = "/api/dive";
      const diveApiResponse = await fetchWithSessionRefresh(diveApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery, pages: top2results }),
        signal,
      });
      if (signal.aborted) return;

      if (!diveApiResponse.ok) {
        const errorData = await diveApiResponse.json().catch(() => ({ error: "Unknown error from Dive API" }));
        throw new Error(`Dive API request failed: ${diveApiResponse.statusText} - ${errorData.error || "Details unavailable"}`);
      }

      const diveData: DiveApiResponse = await diveApiResponse.json();
      if (signal.aborted) return;

      setLlmResponse(diveData.response);
      setSources(diveData.sources);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Dive fetch aborted');
        return;
      }
      console.error("Dive mode error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [setIsLoading, setError, setLlmResponse, setSources]); // Dependencies are stable setters

  useEffect(() => {
    const abortController = new AbortController();
    if (queryParam) {
      setQuery(queryParam);
      setCurrentSearchInput(queryParam);
      fetchDiveData(queryParam, abortController.signal);
    }
    return () => {
      abortController.abort();
    };
  }, [queryParam, fetchDiveData, setQuery, setCurrentSearchInput]);

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpQuestion.trim() || !query) return;

    const chatParams = new URLSearchParams({
      originalQuery: query,
      aiResponse: llmResponse || "",
      followUp: followUpQuestion,
      mode: "dive"
    });
    router.push(`https://chat.tekir.co/?${chatParams.toString()}`);
  };
  
  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSearchInput.trim()) {
      router.push(`/dive?q=${encodeURIComponent(currentSearchInput.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/tekir-head.png" alt="Tekir Logo" width={32} height={32} />
                <span className="font-semibold text-lg">Tekir</span>
              </Link>
              <span className="ml-2 text-sm px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium inline-flex items-center gap-1">
                <Zap size={14} /> Dive
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="https://chat.tekir.co" className="hidden md:flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircleMore size={16} className="mr-1" /> AI Chat
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleNewSearch} className="mb-8 flex gap-2">
          <input
            type="text"
            value={currentSearchInput}
            onChange={(e) => setCurrentSearchInput(e.target.value)}
            placeholder="Dive into a new topic..."
            className="flex-grow px-4 py-2.5 rounded-full border border-border bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center"
            disabled={isLoading || !currentSearchInput.trim()}
          >
            <Search size={20} />
          </button>
        </form>

        {query && <h1 className="text-2xl font-semibold mb-1">Searching for: <span className="text-primary">{query}</span></h1>}
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Diving into information...</p>
            <p className="text-sm text-muted-foreground">Fetching pages and consulting the AI.</p>
          </div>
        )}

        {error && (
          <div className="my-8 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {llmResponse && (
          <div className="mt-6">
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none p-4 border border-border rounded-lg bg-card">
               <MarkdownMessage content={llmResponse} />
            </div>
          </div>
        )}

        {sources && sources.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-3">Sources</h2>
            <div className="space-y-3">
              {sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center text-sm text-primary group-hover:underline mb-1">
                    <span className="truncate">{source.title || new URL(source.url).hostname}</span>
                    <ExternalLink className="w-3 h-3 ml-1.5 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                  {source.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{source.description}</p>}
                </a>
              ))}
            </div>
          </div>
        )}

        {llmResponse && query && (
          <div className="mt-10 pt-6 border-t border-border">
            <h2 className="text-lg font-semibold mb-3">Ask a follow-up</h2>
            <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={!followUpQuestion.trim()}
                className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
                aria-label="Ask follow-up question"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-4 border-t border-border bg-background mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>Tekir Dive. AI can make mistakes. Consider checking important information.</p>
          <div className="flex items-center space-x-4 mt-2 sm:mt-0">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DivePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
      <DivePageContent />
    </Suspense>
  );
}
