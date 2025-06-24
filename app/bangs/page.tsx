"use client";

import { useState, useEffect } from "react";
import { Search, ArrowLeft, ExternalLink, Zap, Clock, Globe } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import UserProfile from "@/components/user-profile";
import Footer from "@/components/footer";

interface Bang {
  name: string;
  url: string;
  main?: string;
}

type BangsData = Record<string, Bang>;

export default function BangsPage() {
  const [bangs, setBangs] = useState<BangsData>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredBangs, setFilteredBangs] = useState<[string, Bang][]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            setFilteredBangs(Object.entries(bangsData));
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
          setFilteredBangs(Object.entries(bangsData));
          
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

  useEffect(() => {
    // Filter bangs based on search query
    if (!searchQuery.trim()) {
      setFilteredBangs(Object.entries(bangs));
    } else {
      const filtered = Object.entries(bangs).filter(([command, bang]) =>
        command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bang.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBangs(filtered);
    }
  }, [searchQuery, bangs]);

  const bangsCount = Object.keys(bangs).length;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Search</span>
              </Link>
            </div>
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/tekir-head.png"
                alt="Tekir"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="text-xl font-bold">Tekir</span>
            </Link>
            <UserProfile />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <Zap className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            Quick access to everything
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
            Bangs are shortcuts that instantly take you to search results on other sites. 
            Just type <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">!w</code> for Wikipedia, 
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400 ml-1">!g</code> for Google, 
            or any of the thousands of other bangs.
          </p>
          
          {/* Example Usage */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-center">
              <Search className="w-5 h-5 mr-2" />
              How it works
            </h3>
            <div className="space-y-3 text-left">
              <div className="flex items-center space-x-3">
                <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">Example</span>
                <code className="bg-white dark:bg-gray-800 px-3 py-2 rounded border flex-1 font-mono text-sm">!w quantum physics</code>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded">Result</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">Instantly searches Wikipedia for "quantum physics"</span>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search bangs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-gray-800/50 transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-blue-600 dark:text-blue-400 font-mono font-semibold text-lg">
                      {command}
                    </code>
                    {bang.main && (
                      <a
                        href={bang.main}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Visit main site"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                    {bang.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">
                    {bang.url.replace('{search}', '...')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Show more button for large results */}
          {!isLoading && filteredBangs.length > 100 && (
            <div className="text-center mt-8">
              <p className="text-gray-600 dark:text-gray-400">
                Showing 100 of {filteredBangs.length} results. Use search to narrow down results.
              </p>
            </div>
          )}

          {/* No results */}
          {!isLoading && filteredBangs.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No bangs found matching "{searchQuery}"</p>
                <p className="text-sm mt-2">Try a different search term</p>
              </div>
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">💡 Pro Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Pure bang:</strong> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">!w cats</code>
              <br />
              <span className="text-gray-600 dark:text-gray-400">Searches Wikipedia for "cats"</span>
            </div>
            <div>
              <strong>Embedded bang:</strong> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">cats !w</code>
              <br />
              <span className="text-gray-600 dark:text-gray-400">Also searches Wikipedia for "cats"</span>
            </div>
            <div>
              <strong>Just the bang:</strong> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">!w</code>
              <br />
              <span className="text-gray-600 dark:text-gray-400">Takes you to Wikipedia's homepage</span>
            </div>
            <div>
              <strong>Mixed search:</strong> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">cute !w cats</code>
              <br />
              <span className="text-gray-600 dark:text-gray-400">Searches Wikipedia for "cute cats"</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}