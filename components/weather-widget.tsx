"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Eye, Droplets, Thermometer } from "lucide-react";

interface WeatherData {
    coord: {
        lon: number;
        lat: number;
    };
    weather: Array<{
        id: number;
        main: string;
        description: string;
        icon: string;
    }>;
    base: string;
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        pressure: number;
        humidity: number;
        sea_level?: number;
        grnd_level?: number;
    };
    visibility: number;
    wind: {
        speed: number;
        deg: number;
        gust?: number;
    };
    clouds: {
        all: number;
    };
    dt: number;
    sys: {
        type: number;
        id: number;
        country: string;
        sunrise: number;
        sunset: number;
    };
    timezone: number;
    id: number;
    name: string;
    cod: number;
}

function getWeatherIcon(condition: string) {
    const normalizedCondition = condition.toLowerCase();
    
    if (normalizedCondition.includes('clear') || normalizedCondition.includes('sunny')) {
        return <Sun className="w-4 h-4 text-yellow-500" />;
    } else if (normalizedCondition.includes('cloud')) {
        return <Cloud className="w-4 h-4 text-gray-500" />;
    } else if (normalizedCondition.includes('rain') || normalizedCondition.includes('drizzle')) {
        return <CloudRain className="w-4 h-4 text-blue-500" />;
    } else if (normalizedCondition.includes('snow')) {
        return <CloudSnow className="w-4 h-4 text-blue-200" />;
    } else {
        return <Cloud className="w-4 h-4 text-gray-500" />;
    }
}

// Temperature conversion functions
function celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32;
}

function formatTemperature(temperature: number, units: string): string {
    // Safety check for undefined or invalid temperature
    if (typeof temperature !== 'number' || isNaN(temperature)) {
        return '--°';
    }
    
    if (units === 'imperial') {
        return `${Math.round(celsiusToFahrenheit(temperature))}°F`;
    }
    return `${Math.round(temperature)}°C`;
}

export default function WeatherWidget() {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clim8Enabled, setClim8Enabled] = useState(true);
    const [locationKey, setLocationKey] = useState<string>("");
    const [weatherUnits, setWeatherUnits] = useState("metric");

    // Effect to track custom location changes
    useEffect(() => {
        const storedLocation = localStorage.getItem("customWeatherLocation");
        let newKey = "ip-based";
        if (storedLocation) {
            try {
                const location = JSON.parse(storedLocation);
                // Validate the location object
                if (location && typeof location.lat === 'number' && typeof location.lon === 'number') {
                    newKey = `${location.lat}-${location.lon}`;
                    console.log("Custom weather location detected:", location);
                } else {
                    console.warn("Invalid stored weather location data:", location);
                    // Clear invalid data
                    localStorage.removeItem("customWeatherLocation");
                }
            } catch (error) {
                console.warn("Failed to parse stored weather location:", error);
                // Clear invalid data
                localStorage.removeItem("customWeatherLocation");
            }
        } else {
            console.log("No custom weather location set, using IP-based location");
        }
        console.log("Setting location key to:", newKey);
        setLocationKey(newKey);
    }, []);

    // Effect to load weather units from localStorage
    useEffect(() => {
        const storedWeatherUnits = localStorage.getItem("weatherUnits");
        if (storedWeatherUnits) {
            setWeatherUnits(storedWeatherUnits);
        }
    }, []);

    useEffect(() => {
        // Check if Clim8 is enabled in settings
        const storedClim8Setting = localStorage.getItem("clim8Enabled");
        const isClim8Enabled = storedClim8Setting !== null ? storedClim8Setting === "true" : true;
        setClim8Enabled(isClim8Enabled);

        // If Clim8 is disabled, don't fetch weather data
        if (!isClim8Enabled) {
            setLoading(false);
            return;
        }

        // Clear any conflicting cache data on initialization
        const clearConflictingCache = () => {
            const storedLocation = localStorage.getItem("customWeatherLocation");
            if (storedLocation) {
                // Custom location is set, clear IP-based cache
                localStorage.removeItem('weather-data');
                localStorage.removeItem('weather-timestamp');
            } else {
                // No custom location, clear all custom location caches
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('weather-data-') && key !== 'weather-data') {
                        localStorage.removeItem(key);
                    }
                    if (key.startsWith('weather-timestamp-') && key !== 'weather-timestamp') {
                        localStorage.removeItem(key);
                    }
                });
            }
        };

        clearConflictingCache();

        const fetchWeather = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Check for custom weather location
                const storedLocation = localStorage.getItem("customWeatherLocation");
                let customLocation = null;
                if (storedLocation) {
                    try {
                        const parsed = JSON.parse(storedLocation);
                        // Validate that the parsed object has the required properties
                        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
                            customLocation = parsed;
                        } else {
                            console.warn("Invalid custom weather location data:", parsed);
                            // Clear invalid data
                            localStorage.removeItem("customWeatherLocation");
                        }
                    } catch (error) {
                        console.warn("Failed to parse custom weather location:", error);
                        // Clear invalid data
                        localStorage.removeItem("customWeatherLocation");
                    }
                }
                
                // Create cache key based on location type
                const cacheKey = customLocation 
                    ? `weather-data-${customLocation.lat}-${customLocation.lon}`
                    : 'weather-data';
                const timestampKey = customLocation
                    ? `weather-timestamp-${customLocation.lat}-${customLocation.lon}`
                    : 'weather-timestamp';
                
                // Check for cached weather data (valid for 10 minutes)
                // ALWAYS prioritize custom location cache if custom location is set
                if (customLocation) {
                    // Try custom location cache first
                    try {
                        const customCacheKey = `weather-data-${customLocation.lat}-${customLocation.lon}`;
                        const customTimestampKey = `weather-timestamp-${customLocation.lat}-${customLocation.lon}`;
                        const cachedData = localStorage.getItem(customCacheKey);
                        const cachedTimestamp = localStorage.getItem(customTimestampKey);
                        
                        if (cachedData && cachedTimestamp) {
                            const age = Date.now() - parseInt(cachedTimestamp);
                            if (age < 10 * 60 * 1000) { // 10 minutes
                                console.log("Using cached custom location weather data");
                                setWeather(JSON.parse(cachedData));
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (cacheError) {
                        console.warn("Custom location cache access failed:", cacheError);
                    }
                } else {
                    // Only check IP-based cache if no custom location is set
                    try {
                        const cachedData = localStorage.getItem('weather-data');
                        const cachedTimestamp = localStorage.getItem('weather-timestamp');
                        
                        if (cachedData && cachedTimestamp) {
                            const age = Date.now() - parseInt(cachedTimestamp);
                            if (age < 10 * 60 * 1000) { // 10 minutes
                                console.log("Using cached IP-based weather data");
                                setWeather(JSON.parse(cachedData));
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (cacheError) {
                        console.warn("IP-based cache access failed:", cacheError);
                    }
                }

                // Determine API endpoint and request body based on location type
                let apiUrl, method;
                if (customLocation) {
                    method = "GET";  
                    apiUrl = `https://clim8.tekir.co/api/weather/current?lat=${customLocation.lat}&lon=${customLocation.lon}&units=${localStorage.getItem("weatherUnits") || "metric"}`;
                    console.log("Fetching weather for custom location:", customLocation);
                } else {
                    // Use IP lookup endpoint for automatic location
                    method = "POST";
                    apiUrl = "https://clim8.tekir.co/api/weather/ip-lookup";
                    console.log("Fetching weather for IP-based location");
                }

                const fetchOptions: RequestInit = {
                    method: method,
                    headers: {
                        "Content-Type": "application/json",
                        "Origin": "https://tekir.co",
                    },
                };
                const response = await fetch(apiUrl, fetchOptions);

                if (!response.ok) {
                    throw new Error(`Weather API responded with status: ${response.status}`);
                }

                const data: WeatherData = await response.json();
                
                // Validate the response data
                if (!data || !data.weather || !data.main) {
                    throw new Error("Invalid weather data received from API");
                }
                
                console.log("Weather data received:", data);
                
                // Cache the weather data with appropriate keys
                try {
                    if (customLocation) {
                        // Store custom location data with coordinates-based keys
                        const customCacheKey = `weather-data-${customLocation.lat}-${customLocation.lon}`;
                        const customTimestampKey = `weather-timestamp-${customLocation.lat}-${customLocation.lon}`;
                        localStorage.setItem(customCacheKey, JSON.stringify(data));
                        localStorage.setItem(customTimestampKey, Date.now().toString());
                        console.log("Cached custom location weather data");
                        
                        // Clear any old IP-based cache to avoid conflicts
                        localStorage.removeItem('weather-data');
                        localStorage.removeItem('weather-timestamp');
                    } else {
                        // Store IP-based data with standard keys
                        localStorage.setItem('weather-data', JSON.stringify(data));
                        localStorage.setItem('weather-timestamp', Date.now().toString());
                        console.log("Cached IP-based weather data");
                        
                        // Clear any old custom location cache to avoid conflicts
                        const keys = Object.keys(localStorage);
                        keys.forEach(key => {
                            if (key.startsWith('weather-data-') && key !== 'weather-data') {
                                localStorage.removeItem(key);
                            }
                            if (key.startsWith('weather-timestamp-') && key !== 'weather-timestamp') {
                                localStorage.removeItem(key);
                            }
                        });
                    }
                } catch (cacheError) {
                    console.warn("Cache write failed:", cacheError);
                }
                
                setWeather(data);
            } catch (err) {
                console.error("Failed to fetch weather:", err);
                setError("Unable to load weather data");
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [locationKey]);

    // Listen for localStorage changes
    useEffect(() => {
        const handleStorageChange = () => {
            const storedLocation = localStorage.getItem("customWeatherLocation");
            let newKey = "ip-based";
            if (storedLocation) {
                try {
                    const location = JSON.parse(storedLocation);
                    // Validate the location object
                    if (location && typeof location.lat === 'number' && typeof location.lon === 'number') {
                        newKey = `${location.lat}-${location.lon}`;
                    } else {
                        console.warn("Invalid stored weather location data:", location);
                        newKey = "ip-based";
                    }
                } catch (error) {
                    console.warn("Failed to parse stored weather location:", error);
                    newKey = "ip-based";
                }
            }
            if (newKey !== locationKey) {
                setLocationKey(newKey);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        
        // Also check periodically for changes (in case localStorage is changed in the same tab)
        const interval = setInterval(handleStorageChange, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [locationKey]);

    // Listen for weather units changes
    useEffect(() => {
        const handleWeatherUnitsChange = () => {
            const storedWeatherUnits = localStorage.getItem("weatherUnits");
            if (storedWeatherUnits && storedWeatherUnits !== weatherUnits) {
                setWeatherUnits(storedWeatherUnits);
            }
        };

        window.addEventListener('storage', handleWeatherUnitsChange);
        
        // Also check periodically for changes (in case localStorage is changed in the same tab)
        const interval = setInterval(handleWeatherUnitsChange, 1000);

        return () => {
            window.removeEventListener('storage', handleWeatherUnitsChange);
            clearInterval(interval);
        };
    }, [weatherUnits]);

    // If Clim8 is disabled, show static weather button
    if (!clim8Enabled) {
        return (
            <a 
                href="https://clim8.tekir.co" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
                <Cloud className="w-4 h-4" />
                <span className="font-medium">Weather</span>
            </a>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 bg-muted animate-pulse rounded"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-20"></div>
            </div>
        );
    }

    if (error || !weather || !weather.weather || !weather.main) {
        return (
            <a 
                href="https://clim8.tekir.co" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
                <Cloud className="w-4 h-4" />
                <span className="font-medium">Weather</span>
            </a>
        );
    }

    return (
        <div className="relative group">
            <a 
                href="https://clim8.tekir.co" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
                {getWeatherIcon(weather.weather[0]?.main || '')}
                <span className="font-medium">
                    {weather.name || 'Unknown'} • {formatTemperature(weather.main?.temp, weatherUnits)}
                </span>
            </a>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                Based on your IP, provided by Clim8.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
            </div>
        </div>
    );
}
