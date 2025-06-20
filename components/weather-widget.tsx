"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Eye, Droplets, Thermometer } from "lucide-react";

interface WeatherData {
  location: {
    city: string;
    country: string;
    coordinates: { lat: number; lon: number };
  };
  weather: {
    temperature: number;
    feelsLike: number;
    condition: string;
    description: string;
    humidity: number;
    windSpeed: number;
    pressure: number;
    visibility: number;
  };
  timestamp: string;
  source: string;
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

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clim8Enabled, setClim8Enabled] = useState(true);

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

    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check for cached weather data (valid for 10 minutes)
        try {
          const cachedData = localStorage.getItem('weather-data');
          const cachedTimestamp = localStorage.getItem('weather-timestamp');
          
          if (cachedData && cachedTimestamp) {
            const age = Date.now() - parseInt(cachedTimestamp);
            if (age < 10 * 60 * 1000) { // 10 minutes
              setWeather(JSON.parse(cachedData));
              setLoading(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn("Cache access failed:", cacheError);
        }

        const response = await fetch("https://clim8.tekir.co/api/weather/ip-lookup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": "https://tekir.co",
            },
        });

        if (!response.ok) {
          throw new Error(`Weather API responded with status: ${response.status}`);
        }

        const data: WeatherData = await response.json();
        
        // Cache the weather data
        try {
          localStorage.setItem('weather-data', JSON.stringify(data));
          localStorage.setItem('weather-timestamp', Date.now().toString());
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
  }, []);

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

  if (error || !weather) {
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
        {getWeatherIcon(weather.weather.condition)}
        <span className="font-medium">
          {weather.location.city} • {Math.round(weather.weather.temperature)}°C
        </span>
      </a>
      
      {/* Tooltip */}
    {/* Tooltip */}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
      Based on your IP, provided by Clim8.
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}
