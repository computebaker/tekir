"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ExternalLink, Zap, Clock, Globe } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import UserProfile from "@/components/user-profile";
import Footer from "@/components/footer";
import { TopNavSimple } from "@/components/layout/top-nav-simple";
import { BadgeChip } from "@/components/shared/badge-chip";
import { EmptyState } from "@/components/shared/empty-state";

interface Bang {
  name: string;
  url: string;
  main?: string;
}

type BangsData = Record<string, Bang>;

export default function BangsPage() {
  const [bangs, setBangs] = useState<BangsData>({});
  const [searchQuery, setSearchQuery] = useState("");
  // We'll keep a simple memo since filtering could be moderately expensive on very large lists.
  const [filteredBangsInternal, setFilteredBangsInternal] = useState<[string, Bang][]>([]); // temporary for initial load population
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "Bangs | Tekir";
  }, []);

  useEffect(() => {
    // Load bangs from localStorage cache
    const loadBangs = () => {
      const cachedBangs = localStorage.getItem('tekir_bangs_cache');
      const cacheExpiry = localStorage.getItem('tekir_bangs_cache_expiry');
      
      if (cachedBangs && cacheExpiry) {
        const expiryDate = parseInt(cacheExpiry, 10);
        if (Date.now() < expiryDate) {
          try {
            const bangsData = JSON.parse(cachedBangs);
            setBangs(bangsData);
            setFilteredBangsInternal(Object.entries(bangsData));
            setIsLoading(false);
            return;
          } catch (e) {
            console.warn('Failed to parse cached bangs', e);
          }
        }
      }
      
      // If no valid cache, try to fetch from the API
      fetchBangs();
    };

    const fetchBangs = async () => {
      try {
        const response = await fetch('https://bang.lat/bangs.json');
        if (response.ok) {
          const bangsData = await response.json();
          setBangs(bangsData);
          setFilteredBangsInternal(Object.entries(bangsData));
          
          // Cache the data
          localStorage.setItem('tekir_bangs_cache', JSON.stringify(bangsData));
          localStorage.setItem('tekir_bangs_cache_expiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        }
      } catch (error) {
        console.error('Failed to fetch bangs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBangs();
  }, []);

  const filteredBangs = useMemo(() => {
    if (isLoading) return filteredBangsInternal; // during initial load, show whatever we populated
    const entries = Object.entries(bangs);
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(([command, bang]) => command.toLowerCase().includes(q) || bang.name.toLowerCase().includes(q));
  }, [bangs, searchQuery, isLoading, filteredBangsInternal]);

  const bangsCount = Object.keys(bangs).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
    <TopNavSimple backHref="/" backLabel="Back to Search" centerLogoHeight={40} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gradient-to-b from-background via-background to-purple-50/30 dark:to-purple-950/10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-muted rounded-full">
              <Zap className="w-12 h-12 text-orange-600" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            Quick access to everything
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Bangs are shortcuts that instantly take you to search results on other sites. 
            Just type <code className="bg-muted px-2 py-1 rounded text-orange-600">!w</code> for Wikipedia, 
            <code className="bg-muted px-2 py-1 rounded text-orange-600 ml-1">!g</code> for Google, 
            or any of the thousands of other bangs.
          </p>
          
          {/* Example Usage */}
          <div className="bg-muted/50 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-center">
              <Search className="w-5 h-5 mr-2" />
              How it works
            </h3>
        <div className="space-y-3 text-left">
              <div className="flex items-center space-x-3">
                <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded">Example</span>
                <code className="bg-background px-3 py-2 rounded border border-border flex-1 font-mono text-sm">!w quantum physics</code>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded">Result</span>
          <span className="text-muted-foreground text-sm">Instantly searches Wikipedia for &quot;quantum physics&quot;</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and List Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-bold mb-4 sm:mb-0">
              {isLoading ? (
                "Loading bangs..."
              ) : (
                `Use all ${bangsCount.toLocaleString()} of them`
              )}
            </h2>
            
            {/* Search Box */}
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search bangs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-2">
                <Clock className="w-5 h-5 animate-spin" />
                <span>Loading bangs...</span>
              </div>
            </div>
          )}

          {/* Bangs Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBangs.slice(0, 100).map(([command, bang]) => (
                <div
                  key={command}
                  className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-orange-600 font-mono font-semibold text-lg">
                      {command}
                    </code>
                    {bang.main && (
                      <a
                        href={bang.main}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title="Visit main site"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <h3 className="font-medium text-foreground mb-2 line-clamp-2">
                    {bang.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono break-all">
                    {bang.url.replace('{search}', '...')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Show more button for large results */}
          {!isLoading && filteredBangs.length > 100 && (
            <div className="text-center mt-8">
              <p className="text-muted-foreground">
                Showing 100 of {filteredBangs.length} results. Use search to narrow down results.
              </p>
            </div>
          )}

          {/* No results */}
          {!isLoading && filteredBangs.length === 0 && searchQuery && (
            <EmptyState
              icon={<Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />}
              title={`No bangs found matching "${searchQuery}"`}
              description={<span className="text-sm">Try a different search term</span>}
            />
          )}
        </div>

        {/* Tips Section */}
        <div className="bg-muted rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">💡 Pro Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Pure bang:</strong> <code className="bg-muted px-2 py-1 rounded">!w cats</code>
              <br />
              <span className="text-muted-foreground">Searches Wikipedia for &quot;cats&quot;</span>
            </div>
            <div>
              <strong>Embedded bang:</strong> <code className="bg-muted px-2 py-1 rounded">cats !w</code>
              <br />
              <span className="text-muted-foreground">Also searches Wikipedia for &quot;cats&quot;</span>
            </div>
            <div>
              <strong>Just the bang:</strong> <code className="bg-muted px-2 py-1 rounded">!w</code>
              <br />
              <span className="text-muted-foreground">Takes you to Wikipedia&apos;s homepage</span>
            </div>
            <div>
              <strong>Mixed search:</strong> <code className="bg-muted px-2 py-1 rounded">cute !w cats</code>
              <br />
              <span className="text-muted-foreground">Searches Wikipedia for &quot;cute cats&quot;</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}