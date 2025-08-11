"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Settings as SettingsIcon, Search, User, Shield, Bell, MessageCircleMore, Lock, MapPin, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsShell, type SettingsNavItem, type MobileNavItem } from "@/components/settings/settings-shell";

interface LocationData {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

// Define mobile navigation items for settings
const settingsMobileNavItems: MobileNavItem[] = [
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
  const [weatherPlacementDropdownOpen, setWeatherPlacementDropdownOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  // Refs for click outside handling
  const autocompleteDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const safesearchDropdownRef = useRef<HTMLDivElement>(null);
  const weatherLocationRef = useRef<HTMLDivElement>(null);
  const weatherUnitsDropdownRef = useRef<HTMLDivElement>(null);
  const weatherPlacementDropdownRef = useRef<HTMLDivElement>(null);
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

      if (weatherPlacementDropdownRef.current &&
          !weatherPlacementDropdownRef.current.contains(event.target as Node) &&
          weatherPlacementDropdownOpen) {
        setWeatherPlacementDropdownOpen(false);
      }

      if (mobileSettingsRef.current && !mobileSettingsRef.current.contains(event.target as Node)) {
        setIsMobileSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [autocompleteDropdownOpen, modelDropdownOpen, countryDropdownOpen, safesearchDropdownOpen, showWeatherLocationSuggestions, weatherUnitsDropdownOpen, weatherPlacementDropdownOpen]);

  // Handlers for settings changes
  const handleKarakulakToggle = async () => {
    const newValue = !settings.karakulakEnabled;
    await updateSetting("karakulakEnabled", newValue);
  };

  const handleClim8Toggle = async () => {
    const newValue = !settings.clim8Enabled;
    await updateSetting("clim8Enabled", newValue);
  };

  const handleRecommendationsToggle = async () => {
    const newValue = !(settings.showRecommendations ?? true);
    await updateSetting("showRecommendations", newValue);
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
        return { name: 'Llama 4', icon: '/meta.png', description: 'A powerful and open-source model by Meta' };
      case 'mistral':
        return { name: 'Mistral Mini', icon: '/mistral.png', description: 'A lightweight model by Mistral AI' };
      case 'chatgpt':
        return { name: 'GPT 5 Mini', icon: '/openai.png', description: 'Powerful, efficient model by OpenAI' };
      default:
        return { name: 'Gemini 2.5 Flash', icon: '/google.png', description: 'A fast and intelligent model by Google' };
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

  const sidebarItems: SettingsNavItem[] = [
    { href: "/settings/search", icon: Search, label: "Search", active: true },
    { href: "/settings/account", icon: User, label: "Account" },
    { href: "/settings/privacy", icon: Shield, label: "Privacy" },
  ];

  return (
    <SettingsShell title="Settings" currentSectionLabel="Search" sidebar={sidebarItems} mobileNavItems={settingsMobileNavItems}>
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
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                      <Switch checked={settings.karakulakEnabled} onChange={() => { void handleKarakulakToggle(); }} aria-label="Karakulak AI Mode" />
                    </div>
                  </div>
                </div>

                {/* AI Model Selection */}
                {settings.karakulakEnabled && (
                  <div className="rounded-lg border border-border bg-card p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-lg font-medium">AI Model</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Select your preferred AI model for responses
                        </p>
                      </div>
            <div className="relative w-full sm:w-auto" ref={modelDropdownRef}>
                        <button
                          onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                          className="flex items-center gap-3 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors w-full sm:w-auto sm:min-w-[200px] justify-between"
              aria-haspopup="menu"
              aria-expanded={modelDropdownOpen}
              aria-controls="ai-model-menu"
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
                          <div id="ai-model-menu" role="menu" aria-label="AI model options" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-80 rounded-lg bg-background border border-border shadow-lg z-10">
                            <div className="p-1">
                              <button
                                onClick={() => handleModelChange('llama')}
                                role="menuitemradio"
                                aria-checked={settings.aiModel === 'llama'}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'llama' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/meta.png" alt="Meta Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">Llama 4 Maverick</span>
                                  <span className="text-xs text-muted-foreground text-left">A powerful and open-source model by Meta</span>
                                </div>
                                {settings.aiModel === 'llama' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>
                              
                              <button
                                onClick={() => handleModelChange('gemini')}
                                role="menuitemradio"
                                aria-checked={settings.aiModel === 'gemini'}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'gemini' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/google.png" alt="Google Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">Gemini 2.5 Flash</span>
                                  <span className="text-xs text-muted-foreground text-left">A fast and intelligent model by Google</span>
                                </div>
                                {settings.aiModel === 'gemini' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>

                              <button
                                onClick={() => handleModelChange('chatgpt')}
                                role="menuitemradio"
                                aria-checked={settings.aiModel === 'chatgpt'}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'chatgpt' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/openai.png" alt="OpenAI Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">GPT 5 Mini</span>
                                  <span className="text-xs text-muted-foreground text-left">Powerful, efficient model by OpenAI</span>
                                </div>
                                {settings.aiModel === 'chatgpt' && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </button>

                              <button
                                onClick={() => handleModelChange('mistral')}
                                role="menuitemradio"
                                aria-checked={settings.aiModel === 'mistral'}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors ${
                                  settings.aiModel === 'mistral' ? 'bg-muted' : ''
                                }`}
                              >
                                <Image src="/mistral.png" alt="Mistral Logo" width={24} height={24} className="rounded" />
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm">Mistral Mini</span>
                                  <span className="text-xs text-muted-foreground text-left">A lightweight model by Mistral AI</span>
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-medium">Clim8 Weather Service</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable weather data from Clim8 based on your IP location
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={settings.clim8Enabled} onChange={() => { void handleClim8Toggle(); }} aria-label="Clim8 Weather" />
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
                      <Input
                        type="text"
                        placeholder="Search for a city..."
                        value={weatherLocationQuery}
                        onChange={handleWeatherLocationInput}
                        onFocus={() => setShowWeatherLocationSuggestions(true)}
                        className="w-full pl-10 pr-10"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showWeatherLocationSuggestions && weatherLocationSuggestions.length > 0}
        aria-controls="weather-location-suggestions"
                      />
                      {settings.customWeatherLocation && (
                        <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={handleClearWeatherLocation} aria-label="Clear location">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Location suggestions dropdown */}
                    {showWeatherLocationSuggestions && weatherLocationSuggestions.length > 0 && (
                      <div id="weather-location-suggestions" role="listbox" aria-label="Location suggestions" className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                        {weatherLocationSuggestions.map((location, index) => (
                          <button
                            key={index}
                            onClick={() => handleWeatherLocationSelect(location)}
                            role="option"
                            aria-selected={false}
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-lg font-medium">Weather Units</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose between metric (°C, km/h) or imperial (°F, mph) units
                    </p>
                  </div>
          <div className="relative w-full sm:w-auto" ref={weatherUnitsDropdownRef}>
                    <button
                      onClick={() => setWeatherUnitsDropdownOpen(!weatherUnitsDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors w-full sm:w-auto sm:min-w-[140px] justify-between"
            aria-haspopup="menu"
            aria-expanded={weatherUnitsDropdownOpen}
            aria-controls="weather-units-menu"
                    >
                      <span className="text-sm font-medium capitalize">
                        {settings.weatherUnits === 'metric' ? 'Metric (°C)' : 'Imperial (°F)'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${weatherUnitsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {weatherUnitsDropdownOpen && (
                      <div id="weather-units-menu" role="menu" aria-label="Weather unit options" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-60 rounded-lg bg-background border border-border shadow-lg z-10">
                        <div className="p-1">
                          <button
                            onClick={() => handleWeatherUnitsChange('metric')}
                            role="menuitemradio"
                            aria-checked={settings.weatherUnits === 'metric'}
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
                            role="menuitemradio"
                            aria-checked={settings.weatherUnits === 'imperial'}
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

            {/* Weather Placement */}
            {settings.clim8Enabled && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-lg font-medium">Weather Placement</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose where to show the Clim8 widget on the homepage
                    </p>
                  </div>
                  <div className="relative w-full sm:w-auto" ref={weatherPlacementDropdownRef}>
                    <button
                      onClick={() => setWeatherPlacementDropdownOpen(!weatherPlacementDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors w-full sm:w-auto sm:min-w-[200px] justify-between"
                      aria-haspopup="menu"
                      aria-expanded={weatherPlacementDropdownOpen}
                      aria-controls="weather-placement-menu"
                    >
                      <span className="text-sm font-medium">
                        {(settings.weatherPlacement || 'topRight') === 'hero' ? 'Under search bar' : 'Next to profile'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${weatherPlacementDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {weatherPlacementDropdownOpen && (
                      <div id="weather-placement-menu" role="menu" aria-label="Weather placement options" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-72 rounded-lg bg-background border border-border shadow-lg z-10">
                        <div className="p-1">
                          <button
                            onClick={() => { updateSetting('weatherPlacement', 'hero'); setWeatherPlacementDropdownOpen(false); }}
                            role="menuitemradio"
                            aria-checked={(settings.weatherPlacement || 'topRight') === 'hero'}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                              (settings.weatherPlacement || 'topRight') === 'hero' ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex flex-col items-start flex-1">
                              <span className="font-medium text-sm">Under search bar</span>
                              <span className="text-xs text-muted-foreground">Show weather chip beneath the main search box</span>
                            </div>
                            {(settings.weatherPlacement || 'topRight') === 'hero' && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </button>
                          <button
                            onClick={() => { updateSetting('weatherPlacement', 'topRight'); setWeatherPlacementDropdownOpen(false); }}
                            role="menuitemradio"
                            aria-checked={(settings.weatherPlacement || 'topRight') === 'topRight'}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left ${
                              (settings.weatherPlacement || 'topRight') === 'topRight' ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex flex-col items-start flex-1">
                              <span className="font-medium text-sm">Next to profile</span>
                              <span className="text-xs text-muted-foreground">Show under the welcome text near your avatar</span>
                            </div>
                            {(settings.weatherPlacement || 'topRight') === 'topRight' && (
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

            {/* Homepage Recommendations */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-medium">Homepage Recommendations</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Show daily recommended searches under the search bar on the homepage
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.showRecommendations ?? true}
                    onChange={() => { void handleRecommendationsToggle(); }}
                    aria-label="Show recommendations under search bar"
                  />
                </div>
              </div>
            </div>

            {/* Search Provider */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-medium">Search Provider</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your search engine provider (unchangeable)
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted w-full sm:w-auto justify-center sm:justify-start">
                  <span className="text-sm font-medium">Brave Search</span>
                </div>
              </div>
            </div>

            {/* Autocomplete Provider */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-medium">Autocomplete Provider</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose your search suggestion provider
                  </p>
                </div>
        <div className="relative w-full sm:w-auto" ref={autocompleteDropdownRef}>
                  <button
                    onClick={() => setAutocompleteDropdownOpen(!autocompleteDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors w-full sm:w-auto sm:min-w-[140px] justify-between"
          aria-haspopup="menu"
          aria-expanded={autocompleteDropdownOpen}
          aria-controls="autocomplete-menu"
                  >
                    <span className="text-sm font-medium">
                      {settings.autocompleteSource === "brave" ? "Brave" : "DuckDuckGo"}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${autocompleteDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {autocompleteDropdownOpen && (
                    <div id="autocomplete-menu" role="menu" aria-label="Autocomplete providers" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:min-w-[140px] rounded-lg bg-background border border-border shadow-lg z-10">
                      <div className="py-1">
                        <button
                          onClick={() => handleAutocompleteChange('brave')}
                          role="menuitemradio"
                          aria-checked={settings.autocompleteSource === 'brave'}
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
                          role="menuitemradio"
                          aria-checked={settings.autocompleteSource === 'duck'}
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-medium">Search Region</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose your preferred search region for localized results
                  </p>
                </div>
        <div className="relative w-full sm:w-auto" ref={countryDropdownRef}>
                  <button
                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors w-full sm:w-auto sm:min-w-[200px] justify-between"
          aria-haspopup="menu"
          aria-expanded={countryDropdownOpen}
          aria-controls="country-menu"
                  >
                    <span className="text-sm font-medium">{currentCountry.name}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {countryDropdownOpen && (
                    <div id="country-menu" role="menu" aria-label="Search regions" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-80 rounded-lg bg-background border border-border shadow-lg z-10 max-h-60 overflow-y-auto">
                      <div className="p-1">
                        {COUNTRIES.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => handleCountryChange(country.code)}
                            role="menuitemradio"
                            aria-checked={settings.searchCountry === country.code}
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-medium">SafeSearch</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Filter explicit content from your search results
                  </p>
                </div>
        <div className="relative w-full sm:w-auto" ref={safesearchDropdownRef}>
                  <button
                    onClick={() => setSafesearchDropdownOpen(!safesearchDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors w-full sm:w-auto sm:min-w-[140px] justify-between"
          aria-haspopup="menu"
          aria-expanded={safesearchDropdownOpen}
          aria-controls="safesearch-menu"
                  >
                    <span className="text-sm font-medium">{getSafesearchDisplay(settings.safesearch || 'moderate')}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${safesearchDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {safesearchDropdownOpen && (
                    <div id="safesearch-menu" role="menu" aria-label="SafeSearch levels" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:min-w-[200px] rounded-lg bg-background border border-border shadow-lg z-10">
                      <div className="p-1">
                        <button
                          onClick={() => handleSafesearchChange('off')}
                          role="menuitemradio"
                          aria-checked={settings.safesearch === 'off'}
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
                          role="menuitemradio"
                          aria-checked={settings.safesearch === 'moderate'}
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
                          role="menuitemradio"
                          aria-checked={settings.safesearch === 'strict'}
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
    </SettingsShell>
  );
}
