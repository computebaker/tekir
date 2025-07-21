"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Settings, ArrowLeft, Search, User, Shield, Bell, MessageCircleMore, Lock, MapPin, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import UserProfile from "@/components/user-profile";
import Footer from "@/components/footer";
import Link from "next/link";
import Image from "next/image";
import { useSettings } from "@/lib/settings";

interface LocationData {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

// Define mobile navigation items for settings
const settingsMobileNavItems = [
  {
    href: "/",
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

// Countries/regions data
const COUNTRIES = [
  { code: "ALL", name: "All Regions" },
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CL", name: "Chile" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "Korea" },
  { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" },
  { code: "CN", name: "Peoples Republic of China" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PH", name: "Republic of the Philippines" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TW", name: "Taiwan" },
  { code: "TR", name: "Turkey" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" }
];

export default function SearchSettingsPage() {
  // Use the settings hook for centralized state management
  const { settings, updateSetting, isInitialized, isSyncing, syncEnabled } = useSettings();
  
  // Local UI state
  const [weatherLocationQuery, setWeatherLocationQuery] = useState("");
  const [weatherLocationSuggestions, setWeatherLocationSuggestions] = useState<LocationData[]>([]);
  const [showWeatherLocationSuggestions, setShowWeatherLocationSuggestions] = useState(false);
  const [searchEngine] = useState("brave"); // Unchangeable

  // Dropdown states
  const [autocompleteDropdownOpen, setAutocompleteDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [safesearchDropdownOpen, setSafesearchDropdownOpen] = useState(false);
  const [weatherUnitsDropdownOpen, setWeatherUnitsDropdownOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  // Refs for click outside handling
  const autocompleteDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const safesearchDropdownRef = useRef<HTMLDivElement>(null);
  const weatherLocationRef = useRef<HTMLDivElement>(null);
  const weatherUnitsDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSettingsRef = useRef<HTMLDivElement>(null);

  // Update query display when custom location changes
  useEffect(() => {
    if (settings.customWeatherLocation) {
      setWeatherLocationQuery(`${settings.customWeatherLocation.name}, ${settings.customWeatherLocation.country}`);
    }
  }, [settings.customWeatherLocation]);

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

      if (countryDropdownRef.current &&
          !countryDropdownRef.current.contains(event.target as Node) &&
          countryDropdownOpen) {
        setCountryDropdownOpen(false);
      }

      if (safesearchDropdownRef.current &&
          !safesearchDropdownRef.current.contains(event.target as Node) &&
          safesearchDropdownOpen) {
        setSafesearchDropdownOpen(false);
      }

      if (weatherLocationRef.current &&
          !weatherLocationRef.current.contains(event.target as Node) &&
          showWeatherLocationSuggestions) {
        setShowWeatherLocationSuggestions(false);
      }

      if (weatherUnitsDropdownRef.current &&
          !weatherUnitsDropdownRef.current.contains(event.target as Node) &&
          weatherUnitsDropdownOpen) {
        setWeatherUnitsDropdownOpen(false);
      }

      if (mobileSettingsRef.current && !mobileSettingsRef.current.contains(event.target as Node)) {
        setIsMobileSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [autocompleteDropdownOpen, modelDropdownOpen, countryDropdownOpen, safesearchDropdownOpen, showWeatherLocationSuggestions, weatherUnitsDropdownOpen]);

  // Handlers for settings changes
  const handleKarakulakToggle = () => {
    const newValue = !settings.karakulakEnabled;
    updateSetting("karakulakEnabled", newValue);
  };

  const handleClim8Toggle = () => {
    const newValue = !settings.clim8Enabled;
    updateSetting("clim8Enabled", newValue);
  };

  // Weather location handlers
  const searchWeatherLocations = async (query: string) => {
    if (query.length < 2) {
      setWeatherLocationSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`https://clim8.tekir.co/api/weather/search?q=${encodeURIComponent(query)}&limit=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://tekir.co',
        },
      });

      if (response.ok) {
        const locations = await response.json();
        setWeatherLocationSuggestions(locations);
      } else {
        console.error('Failed to search weather locations:', response.status);
        setWeatherLocationSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching weather locations:', error);
      setWeatherLocationSuggestions([]);
    }
  };

  const handleWeatherLocationInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWeatherLocationQuery(value);
    setShowWeatherLocationSuggestions(true);
    searchWeatherLocations(value);
  };

  const handleWeatherLocationSelect = (location: LocationData) => {
    updateSetting("customWeatherLocation", location);
    setWeatherLocationQuery(`${location.name}, ${location.country}`);
    setShowWeatherLocationSuggestions(false);
  };

  const handleClearWeatherLocation = () => {
    updateSetting("customWeatherLocation", undefined);
    setWeatherLocationQuery("");
  };

  const handleAutocompleteChange = (source: string) => {
    updateSetting("autocompleteSource", source);
    setAutocompleteDropdownOpen(false);
  };

  const handleModelChange = (model: string) => {
    updateSetting("aiModel", model);
    setModelDropdownOpen(false);
  };

  const handleCountryChange = (country: string) => {
    updateSetting("searchCountry", country);
    setCountryDropdownOpen(false);
  };

  const handleSafesearchChange = (safesearchValue: string) => {
    updateSetting("safesearch", safesearchValue);
    setSafesearchDropdownOpen(false);
  };

  const handleWeatherUnitsChange = (units: string) => {
    updateSetting("weatherUnits", units);
    setWeatherUnitsDropdownOpen(false);
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

  const currentModel = getModelDisplay(settings.aiModel || 'gemini');
  const currentCountry = COUNTRIES.find(country => country.code === settings.searchCountry) || COUNTRIES[0];

  const getSafesearchDisplay = (value: string) => {
    switch (value) {
      case 'off':
        return 'Off';
      case 'moderate':
        return 'Moderate';
      case 'strict':
        return 'Strict';
      default:
        return 'Moderate';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to home</span>
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

                  {/* Account Settings */}
                  <Link
                    href="/settings/account"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                  >
                    <User className="w-4 h-4" />
                    <span>Account</span>
                  </Link>

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
            <div className="lg:hidden mb-6 mx-2" ref={mobileSettingsRef}>
              <div className="relative">
                <button
                  onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
                  className="w-full flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 border hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Settings</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-foreground font-medium">Search</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isMobileSettingsOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isMobileSettingsOpen && (
                  <div className="absolute top-full mt-2 w-full rounded-lg bg-background border border-border shadow-lg z-50">
                    <div className="py-1">
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left bg-muted text-foreground cursor-default">
                        <Search className="w-4 h-4" />
                        <span className="font-medium">Search</span>
                      </div>
                      
                      <Link
                        href="/settings/account"
                        onClick={() => setIsMobileSettingsOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>Account</span>
                      </Link>
                      
                      <div className="border-t border-border my-1"></div>
                      
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground cursor-not-allowed opacity-50">
                        <Shield className="w-4 h-4" />
                        <span>Privacy</span>
                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                      </div>
                      
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground cursor-not-allowed opacity-50">
                        <Bell className="w-4 h-4" />
                        <span>Notifications</span>
                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {/* Page Title and Description */}
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Search Settings</h2>
                <p className="text-muted-foreground mt-2">
                  Customize your search experience and AI preferences.
                </p>
              </div>          
          
          {/* Settings Categories */}
          <div className="space-y-8">
            
            {/* AI Features Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">AI Features</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure AI-powered search and response features
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Karakulak AI Mode */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-medium">Karakulak AI Mode</h4>
                        {isSyncing && syncEnabled && (
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enable AI-powered responses for your search queries
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        id="karakulak-toggle" 
                        className="sr-only" 
                        checked={settings.karakulakEnabled}
                        onChange={handleKarakulakToggle}
                      />
                      <label 
                        htmlFor="karakulak-toggle" 
                        className={`relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                          settings.karakulakEnabled ? 'bg-blue-500' : 'bg-muted'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                            settings.karakulakEnabled ? "translate-x-6" : ""
                          }`}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* AI Model Selection */}
                {settings.karakulakEnabled && (
                  <div className="rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-medium">AI Model</h4>
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
                                  settings.aiModel === 'llama' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/meta.png" alt="Meta Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">Llama 3.1 7B</span>
                                  <span className="text-xs text-muted-foreground text-left">A powerful and open-source model by Meta</span>
                                </div>
                                {settings.aiModel === 'llama' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>
                              
                              <button
                                onClick={() => handleModelChange('gemini')}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'gemini' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/google.png" alt="Google Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">Gemini 2.0 Flash</span>
                                  <span className="text-xs text-muted-foreground text-left">A fast and intelligent model by Google</span>
                                </div>
                                {settings.aiModel === 'gemini' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>

                              <button
                                onClick={() => handleModelChange('chatgpt')}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'chatgpt' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/openai.png" alt="OpenAI Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">GPT 4o-mini</span>
                                  <span className="text-xs text-muted-foreground text-left">Powerful, efficient model by OpenAI</span>
                                </div>
                                {settings.aiModel === 'chatgpt' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>

                              <button
                                onClick={() => handleModelChange('mistral')}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'mistral' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/mistral.png" alt="Mistral Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">Mistral Nemo</span>
                                  <span className="text-xs text-muted-foreground text-left">A lightweight and efficient model by Mistral AI</span>
                                </div>
                                {settings.aiModel === 'mistral' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* External Services Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">External Services</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure integrations with external services
                </p>
              </div>
              
              <div className="space-y-4">

            {/* Clim8 Weather Service */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium">Clim8 Weather Service</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable weather data from Clim8 based on your IP location
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="clim8-toggle" 
                    className="sr-only" 
                    checked={settings.clim8Enabled}
                    onChange={handleClim8Toggle}
                  />
                  <label 
                    htmlFor="clim8-toggle" 
                    className={`relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                      settings.clim8Enabled ? 'bg-blue-500' : 'bg-muted'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                        settings.clim8Enabled ? "translate-x-6" : ""
                      }`}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Custom Weather Location */}
            {settings.clim8Enabled && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Custom Weather Location</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Set a preferred location for weather reports instead of using your IP location
                    </p>
                  </div>
                  
                  <div className="relative" ref={weatherLocationRef}>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search for a city..."
                        value={weatherLocationQuery}
                        onChange={handleWeatherLocationInput}
                        onFocus={() => setShowWeatherLocationSuggestions(true)}
                        className="w-full pl-10 pr-10 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      {settings.customWeatherLocation && (
                        <button
                          onClick={handleClearWeatherLocation}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Location suggestions dropdown */}
                    {showWeatherLocationSuggestions && weatherLocationSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                        {weatherLocationSuggestions.map((location, index) => (
                          <button
                            key={index}
                            onClick={() => handleWeatherLocationSelect(location)}
                            className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                          >
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span>{location.name}, {location.country}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {settings.customWeatherLocation && (
                      <div className="mt-2 p-2 bg-muted rounded-md flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          Selected: {settings.customWeatherLocation.name}, {settings.customWeatherLocation.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Weather Units */}
            {settings.clim8Enabled && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium">Weather Units</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose between metric (°C, km/h) or imperial (°F, mph) units
                    </p>
                  </div>
                  <div className="relative" ref={weatherUnitsDropdownRef}>
                    <button
                      onClick={() => setWeatherUnitsDropdownOpen(!weatherUnitsDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors min-w-[140px] justify-between"
                    >
                      <span className="text-sm font-medium capitalize">
                        {settings.weatherUnits === 'metric' ? 'Metric (°C)' : 'Imperial (°F)'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${weatherUnitsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {weatherUnitsDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-60 rounded-lg bg-background border border-border shadow-lg z-10">
                        <div className="p-1">
                          <button
                            onClick={() => handleWeatherUnitsChange('metric')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                              settings.weatherUnits === 'metric' ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex flex-col items-start flex-1">
                              <span className="font-medium text-sm">Metric</span>
                              <span className="text-xs text-muted-foreground">°C, km/h, mm</span>
                            </div>
                            {settings.weatherUnits === 'metric' && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleWeatherUnitsChange('imperial')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                              settings.weatherUnits === 'imperial' ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex flex-col items-start flex-1">
                              <span className="font-medium text-sm">Imperial</span>
                              <span className="text-xs text-muted-foreground">°F, mph, in</span>
                            </div>
                            {settings.weatherUnits === 'imperial' && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>

            {/* Search Options Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">Search Options</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure your search provider and filtering preferences
                </p>
              </div>
              
              <div className="space-y-4">

            {/* Search Provider */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium">Search Provider</h4>
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
                  <h4 className="text-lg font-medium">Autocomplete Provider</h4>
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
                      {settings.autocompleteSource === "brave" ? "Brave" : "DuckDuckGo"}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${autocompleteDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {autocompleteDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-full min-w-[140px] rounded-lg bg-background border border-border shadow-lg z-10">
                      <div className="py-1">
                        <button
                          onClick={() => handleAutocompleteChange('brave')}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${
                            settings.autocompleteSource === "brave" ? "bg-muted" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {settings.autocompleteSource === "brave" && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </div>
                          <span>Brave</span>
                        </button>
                        
                        <button
                          onClick={() => handleAutocompleteChange('duck')}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${
                            settings.autocompleteSource === "duck" ? "bg-muted" : ""
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {settings.autocompleteSource === "duck" && (
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

            {/* Search Region/Country */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium">Search Region</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose your preferred search region for localized results
                  </p>
                </div>
                <div className="relative" ref={countryDropdownRef}>
                  <button
                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors min-w-[200px] justify-between"
                  >
                    <span className="text-sm font-medium">{currentCountry.name}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {countryDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-lg bg-background border border-border shadow-lg z-10 max-h-60 overflow-y-auto">
                      <div className="p-1">
                        {COUNTRIES.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => handleCountryChange(country.code)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                              settings.searchCountry === country.code ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex flex-col items-start flex-1">
                              <span className="font-medium text-sm">{country.name}</span>
                              <span className="text-xs text-muted-foreground">{country.code}</span>
                            </div>
                            {settings.searchCountry === country.code && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SafeSearch */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium">SafeSearch</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Filter explicit content from your search results
                  </p>
                </div>
                <div className="relative" ref={safesearchDropdownRef}>
                  <button
                    onClick={() => setSafesearchDropdownOpen(!safesearchDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors min-w-[140px] justify-between"
                  >
                    <span className="text-sm font-medium">{getSafesearchDisplay(settings.safesearch || 'moderate')}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${safesearchDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {safesearchDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-full min-w-[200px] rounded-lg bg-background border border-border shadow-lg z-10">
                      <div className="p-1">
                        <button
                          onClick={() => handleSafesearchChange('off')}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                            settings.safesearch === 'off' ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">Off</span>
                            <span className="text-xs text-muted-foreground">Show all results</span>
                          </div>
                          {settings.safesearch === 'off' && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleSafesearchChange('moderate')}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                            settings.safesearch === 'moderate' ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">Moderate</span>
                            <span className="text-xs text-muted-foreground">Filter explicit content</span>
                          </div>
                          {settings.safesearch === 'moderate' && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </button>

                        <button
                          onClick={() => handleSafesearchChange('strict')}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                            settings.safesearch === 'strict' ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-medium text-sm">Strict</span>
                            <span className="text-xs text-muted-foreground">Maximum filtering</span>
                          </div>
                          {settings.safesearch === 'strict' && (
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
            </div>
          </div>

              {/* Footer Note */}
              <div className="text-center text-sm text-muted-foreground">
                {isSyncing && syncEnabled ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p>Syncing settings to server...</p>
                  </div>
                ) : syncEnabled ? (
                  <p>Settings are automatically saved and synced across devices.</p>
                ) : (
                  <p>Settings are automatically saved to your local storage.</p>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      <Footer variant="full" />
    </div>
  );
}
