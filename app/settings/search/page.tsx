"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Settings, ArrowLeft, Search, User, Shield, Bell, MessageCircleMore, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import UserProfile from "@/components/user-profile";
import Link from "next/link";
import Image from "next/image";

// Define mobile navigation items for settings
const settingsMobileNavItems = [
  {
    href: "/search",
    icon: Search,
    label: "Back to Search"
  },
  {
    href: "https://chat.tekir.co",
    icon: MessageCircleMore,
    label: "AI Chat"
  },
  {
    href: "/about",
    icon: Lock,
    label: "Privacy Policy"
  }
];

export default function SearchSettingsPage() {
  // State for all settings
  const [karakulakEnabled, setKarakulakEnabled] = useState(true);
  const [searchEngine] = useState("brave"); // Unchangeable
  const [autocompleteSource, setAutocompleteSource] = useState("brave");
  const [aiModel, setAiModel] = useState("gemini");

  // Dropdown states
  const [autocompleteDropdownOpen, setAutocompleteDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Refs for click outside handling
  const autocompleteDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const storedKarakulak = localStorage.getItem("karakulakEnabled");
    if (storedKarakulak !== null) {
      setKarakulakEnabled(storedKarakulak === "true");
    }

    const storedAutocomplete = localStorage.getItem("autocompleteSource");
    if (storedAutocomplete) {
      setAutocompleteSource(storedAutocomplete);
    }

    const storedModel = localStorage.getItem("aiModel");
    if (storedModel) {
      setAiModel(storedModel);
    }
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteDropdownRef.current &&
          !autocompleteDropdownRef.current.contains(event.target as Node) &&
          autocompleteDropdownOpen) {
        setAutocompleteDropdownOpen(false);
      }

      if (modelDropdownRef.current &&
          !modelDropdownRef.current.contains(event.target as Node) &&
          modelDropdownOpen) {
        setModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [autocompleteDropdownOpen, modelDropdownOpen]);

  // Handlers for settings changes
  const handleKarakulakToggle = () => {
    const newValue = !karakulakEnabled;
    setKarakulakEnabled(newValue);
    localStorage.setItem("karakulakEnabled", newValue.toString());
  };

  const handleAutocompleteChange = (source: string) => {
    setAutocompleteSource(source);
    localStorage.setItem("autocompleteSource", source);
    setAutocompleteDropdownOpen(false);
  };

  const handleModelChange = (model: string) => {
    setAiModel(model);
    localStorage.setItem("aiModel", model);
    setModelDropdownOpen(false);
  };

  const getModelDisplay = (model: string) => {
    switch (model) {
      case 'llama':
        return { name: 'Llama 3.1 7B', icon: '/meta.png', description: 'A powerful and open-source model by Meta' };
      case 'mistral':
        return { name: 'Mistral Nemo', icon: '/mistral.png', description: 'A lightweight and efficient model by Mistral AI' };
      case 'chatgpt':
        return { name: 'GPT 4o-mini', icon: '/openai.png', description: 'Powerful, efficient model by OpenAI' };
      default:
        return { name: 'Gemini 2.0 Flash', icon: '/google.png', description: 'A fast and intelligent model by Google' };
    }
  };

  const currentModel = getModelDisplay(aiModel);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/search" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Search</span>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <h1 className="text-lg font-semibold">Settings</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserProfile mobileNavItems={settingsMobileNavItems} />
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8 mb-16">
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <div className="rounded-lg border border-border bg-card p-4 mx-2 lg:mx-0">
                <nav className="space-y-1">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Settings
                    </h2>
                  </div>
                  
                  {/* Search Settings - Active */}
                  <Link
                    href="/settings/search"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 transition-all duration-200 hover:bg-primary/15"
                  >
                    <Search className="w-4 h-4" />
                    <span className="font-medium">Search</span>
                  </Link>

                  {/* Divider */}
                  <div className="my-3 border-t border-border"></div>

                  {/* Future Settings Categories */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-60 transition-opacity">
                    <User className="w-4 h-4" />
                    <span>Account</span>
                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-60 transition-opacity">
                    <Shield className="w-4 h-4" />
                    <span>Privacy</span>
                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-60 transition-opacity">
                    <Bell className="w-4 h-4" />
                    <span>Notifications</span>
                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                  </div>
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-6 mx-2">
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 border">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Settings</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground font-medium">Search</span>
              </div>
            </div>

            <div className="space-y-8">
              {/* Page Title and Description */}
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Search Settings</h2>
                <p className="text-muted-foreground mt-2">
                  Customize your search experience and AI preferences.
                </p>
              </div>          {/* Settings Cards */}
          <div className="space-y-6">
            {/* Karakulak AI Mode */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Karakulak AI Mode</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable AI-powered responses for your search queries
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="karakulak-toggle" 
                    className="sr-only" 
                    checked={karakulakEnabled}
                    onChange={handleKarakulakToggle}
                  />
                  <label 
                    htmlFor="karakulak-toggle" 
                    className={`relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                      karakulakEnabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform duration-200 ease-in-out ${
                        karakulakEnabled ? "translate-x-6" : ""
                      }`}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Search Provider */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Search Provider</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your search engine provider (unchangeable)
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                  <span className="text-sm font-medium">Brave Search</span>
                </div>
              </div>
            </div>

            {/* Autocomplete Provider */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Autocomplete Provider</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose your search suggestion provider
                  </p>
                </div>
                <div className="relative" ref={autocompleteDropdownRef}>
                  <button
                    onClick={() => setAutocompleteDropdownOpen(!autocompleteDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors min-w-[140px] justify-between"
                  >
                    <span className="text-sm font-medium">
                      {autocompleteSource === "brave" ? "Brave" : "DuckDuckGo"}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${autocompleteDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {autocompleteDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-full min-w-[140px] rounded-lg bg-background border border-border shadow-lg z-10">
                      <div className="py-1">
                        <button
                          onClick={() => handleAutocompleteChange('brave')}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${
                            autocompleteSource === "brave" ? "bg-muted" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {autocompleteSource === "brave" && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </div>
                          <span>Brave</span>
                        </button>
                        
                        <button
                          onClick={() => handleAutocompleteChange('duck')}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${
                            autocompleteSource === "duck" ? "bg-muted" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {autocompleteSource === "duck" && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
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

            {/* AI Model Selection */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Karakulak AI Model</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select your preferred AI model for responses
                  </p>
                </div>
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors min-w-[200px] justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Image 
                        src={currentModel.icon} 
                        alt={`${currentModel.name} Logo`} 
                        width={20} 
                        height={20} 
                        className="rounded" 
                      />
                      <span className="text-sm font-medium">{currentModel.name}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {modelDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-lg bg-background border border-border shadow-lg z-10">
                      <div className="p-1">
                        <button
                          onClick={() => handleModelChange('llama')}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                            aiModel === 'llama' ? 'bg-muted' : ''
                          }`}
                        >
                          <Image src="/meta.png" alt="Meta Logo" width={24} height={24} className="rounded" />
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">Llama 3.1 7B</span>
                            <span className="text-xs text-muted-foreground text-left">A powerful and open-source model by Meta</span>
                          </div>
                          {aiModel === 'llama' && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleModelChange('gemini')}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                            aiModel === 'gemini' ? 'bg-muted' : ''
                          }`}
                        >
                          <Image src="/google.png" alt="Google Logo" width={24} height={24} className="rounded" />
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">Gemini 2.0 Flash</span>
                            <span className="text-xs text-muted-foreground text-left">A fast and intelligent model by Google</span>
                          </div>
                          {aiModel === 'gemini' && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </button>

                        <button
                          onClick={() => handleModelChange('chatgpt')}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                            aiModel === 'chatgpt' ? 'bg-muted' : ''
                          }`}
                        >
                          <Image src="/openai.png" alt="OpenAI Logo" width={24} height={24} className="rounded" />
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">GPT 4o-mini</span>
                            <span className="text-xs text-muted-foreground text-left">Powerful, efficient model by OpenAI</span>
                          </div>
                          {aiModel === 'chatgpt' && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </button>

                        <button
                          onClick={() => handleModelChange('mistral')}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                            aiModel === 'mistral' ? 'bg-muted' : ''
                          }`}
                        >
                          <Image src="/mistral.png" alt="Mistral Logo" width={24} height={24} className="rounded" />
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">Mistral Nemo</span>
                            <span className="text-xs text-muted-foreground text-left">A lightweight and efficient model by Mistral AI</span>
                          </div>
                          {aiModel === 'mistral' && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

              {/* Footer Note */}
              <div className="text-center text-sm text-muted-foreground">
                <p>Settings are automatically saved to your local storage.</p>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-300 w-full overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-x-4 sm:gap-x-8 gap-y-10 mb-10">
            {/* Column 1: Logo, Tagline, Discover Button */}
            <div className="lg:col-span-4">
              <div className="mb-5">
                <Image src="/tekir.png" alt="Tekir Logo" width={50} height={150} />
              </div>
              <p className="text-neutral-400 mb-6 text-sm leading-relaxed">
                Tekir is a privacy-friendly search engine that serves the best search experience. 
              </p>
              <Link
                href="/about"
                className="inline-block px-5 py-2 border border-neutral-600 rounded-md text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:border-neutral-500 transition-colors"
              >
                Discover the service
              </Link>
            </div>

            <div className="lg:col-span-2 lg:col-start-6 md:col-start-auto">
              <h3 className="text-base font-semibold text-neutral-100 mb-4">Products</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="text-neutral-400 hover:text-white transition-colors">Search</Link></li>
                <li><Link href="/chat" className="text-neutral-400 hover:text-white transition-colors">AI Chat</Link></li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-base font-semibold text-neutral-100 mb-4">About Tekir</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="/about" className="text-neutral-400 hover:text-white transition-colors">About us</a></li>
                <li><a href="/privacy" className="text-neutral-400 hover:text-white transition-colors">Privacy</a></li>
                <li><a href="/terms" className="text-neutral-400 hover:text-white transition-colors">Terms</a></li>
                <li><a href="https://computebaker.com" className="text-neutral-400 hover:text-white transition-colors">computebaker</a></li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-base font-semibold text-neutral-100 mb-4">Follow us</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="https://instagram.com/tekirsearch" className="text-neutral-400 hover:text-white transition-colors">Instagram</Link></li>
                <li><Link href="https://bsky.app/profile/tekir.co" className="text-neutral-400 hover:text-white transition-colors">Bluesky</Link></li>
              </ul>
            </div>
          </div>

          <hr className="border-neutral-800" />

          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-neutral-500 pt-8 gap-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 sm:gap-x-5 gap-y-2 text-xs sm:text-sm">
              <span className="text-center">&copy; {new Date().getFullYear()} <Link href="https://computebaker.com">computebaker</Link>. All rights reserved.</span>
              <Link href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-neutral-300 transition-colors whitespace-nowrap">Terms of Service</Link>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <iframe 
                src="https://status.tekir.co/en/badge" 
                width="250" 
                height="30" 
                style={{ colorScheme: 'normal', maxWidth: '100%', width: '100%' }}
                className="rounded max-w-full h-auto"
              />
              <Link
                href="https://btt.community/t/tekir-meta-arama-motoru/18108"
                className="shrink-0 px-3 py-2 border border-neutral-700 rounded-md text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 transition-colors text-center"
              >
                <span className="hidden sm:inline">Share your feedback</span>
                <span className="sm:hidden">Feedback</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
