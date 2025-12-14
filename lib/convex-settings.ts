import { useCallback, useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/auth-provider";

// Define the settings structure
export interface UserSettings {
  // Search preferences
  searchEngine?: string;
  searchCountry?: string;
  safesearch?: string;
  autocompleteSource?: string;
  showRecommendations?: boolean;

  // AI preferences
  aiModel?: string;
  karakulakEnabled?: boolean;

  // Weather preferences
  clim8Enabled?: boolean;
  weatherUnits?: string;
  customWeatherLocation?: {
    name: string;
    country: string;
    lat: number;
    lon: number;
  };
  weatherPlacement?: 'hero' | 'topRight';

  // UI preferences
  theme?: string;
  searchType?: string;
  // Enchanted Results — show/hide News and Videos widgets
  enchantedResults?: boolean;

  // Wikipedia preferences
  wikipediaEnabled?: boolean;

  // UI: show favicons near results
  showFavicons?: boolean;

  // AI model-specific settings
  karakulakEnabled_llama?: boolean;
  karakulakEnabled_gemini?: boolean;
  karakulakEnabled_chatgpt?: boolean;
  karakulakEnabled_mistral?: boolean;
  karakulakEnabled_grok?: boolean;

  // i18n: User's preferred language (ISO 639-1 code)
  // @see /.github/instructions/i18n.instructions.md
  language?: string;

  // Logo preference
  selectedLogo?: 'tekir' | 'duman' | 'pamuk';
}

// Default settings values
export const DEFAULT_SETTINGS: UserSettings = {
  searchEngine: "brave",
  searchCountry: "ALL",
  safesearch: "moderate",
  autocompleteSource: "brave",
  showRecommendations: true,
  aiModel: "gemini",
  karakulakEnabled: true,
  clim8Enabled: true,
  weatherUnits: "metric",
  weatherPlacement: 'topRight',
  theme: "system",
  searchType: "web",
  enchantedResults: true,
  wikipediaEnabled: true,
  showFavicons: false,
  karakulakEnabled_llama: true,
  karakulakEnabled_gemini: true,
  karakulakEnabled_chatgpt: true,
  karakulakEnabled_mistral: true,
  karakulakEnabled_grok: true,
  language: "en", // Default language: English
  selectedLogo: "tekir", // Default logo: Tekir
};

class ConvexSettingsManager {
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<() => void> = new Set();
  private userId: string | null = null;
  private hasLoadedLocalStorage = false;

  initialize(userId?: string | null) {
    this.userId = userId || null;
    this.hasLoadedLocalStorage = false;
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    if (typeof window === 'undefined' || this.hasLoadedLocalStorage) return;

    // Load all settings from localStorage as fallback
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        try {
          // Handle different data types
          if (key === 'customWeatherLocation') {
            (this.settings as any)[key] = JSON.parse(stored);
          } else if (typeof DEFAULT_SETTINGS[key as keyof UserSettings] === 'boolean') {
            (this.settings as any)[key] = stored === 'true';
          } else {
            (this.settings as any)[key] = stored;
          }
        } catch (error) {
          console.error(`Failed to parse setting ${key}:`, error);
        }
      }
    });
    this.hasLoadedLocalStorage = true;
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined') return;

    Object.entries(this.settings).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, String(value));
        }
      }
    });
  }

  /**
   * Save settings that came from Convex to localStorage but do not overwrite
   * any keys that already exist locally. This preserves an explicit local
   * preference (e.g. the user toggled a setting in the UI) while still
   * seeding missing values from the server.
   */
  private saveConvexToLocalStorageWithoutOverwriting() {
    if (typeof window === 'undefined') return;

    Object.entries(this.settings).forEach(([key, value]) => {
      try {
        const existing = localStorage.getItem(key);
        if (existing !== null) {
          // Respect a local explicit value; do not overwrite.
          return;
        }
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
          } else {
            localStorage.setItem(key, String(value));
          }
        }
      } catch (e) {
        // ignore localStorage errors
      }
    });
  }

  // Update settings from Convex subscription
  updateFromConvex(convexSettings: any) {
    if (convexSettings?.settings) {
      this.settings = { ...DEFAULT_SETTINGS, ...convexSettings.settings };
      // When applying server settings, don't overwrite explicit local values
      // that the user may have set in the browser. Only seed missing keys.
      this.saveConvexToLocalStorageWithoutOverwriting();
      this.notifyListeners();
    }
  }

  // Update individual setting (will be synced via Convex mutation)
  updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    // Immediately update in memory and localStorage
    this.settings[key] = value;
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // Public methods
  get<K extends keyof UserSettings>(key: K): UserSettings[K] {
    if (!this.hasLoadedLocalStorage) {
      this.loadFromLocalStorage();
    }
    return this.settings[key] ?? DEFAULT_SETTINGS[key];
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAll(): UserSettings {
    if (!this.hasLoadedLocalStorage) {
      this.loadFromLocalStorage();
    }
    return { ...this.settings };
  }

  // Helper method to get a localStorage-compatible string value
  getStorageValue(key: keyof UserSettings): string {
    const value = this.get(key);
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value ?? '');
  }
}

// Global settings manager instance
export const convexSettingsManager = new ConvexSettingsManager();

// React hook for using settings with Convex real-time sync
export function useConvexSettings() {
  const { user, status, authToken } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => convexSettingsManager.getAll());
  const [isInitialized, setIsInitialized] = useState(false);
  const [convexAuthReady, setConvexAuthReady] = useState(false);
  const initializationRef = useRef(false);

  // Wait a tick after user is authenticated to ensure Convex auth is set
  useEffect(() => {
    if (status === 'authenticated' && user?.id && authToken) {
      // Small delay to ensure convex.setAuth has completed
      const timer = setTimeout(() => {
        setConvexAuthReady(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setConvexAuthReady(false);
    }
  }, [status, user?.id, authToken]);

  // Convex hooks for real-time data
  const userSettings = useQuery(
    api.settings.getUserSettings,
    convexAuthReady && user?.id && authToken
      ? { userId: user.id as Id<"users">, authToken }
      : "skip"
  );

  const updateSettingsMutation = useMutation(api.settings.updateUserSettings);
  const toggleSyncMutation = useMutation(api.settings.toggleSettingsSync);

  // Initialize manager when user changes
  useEffect(() => {
    if (status === 'loading') return;

    if (!initializationRef.current || (user?.id && user.id !== convexSettingsManager['userId'])) {
      convexSettingsManager.initialize(user?.id);
      // Do not mark 'isInitialized' true here — wait for server-side settings to arrive.
      // For anonymous / logged-out users there is no server subscription, so mark initialized now.
      if (!user?.id) {
        setIsInitialized(true);
      }
      initializationRef.current = true;
    }
  }, [user?.id, status]);

  // Subscribe to real-time settings updates from Convex
  useEffect(() => {
    if (userSettings) {
      convexSettingsManager.updateFromConvex(userSettings);
      // Now that server settings have been applied, the settings manager is fully initialized.
      setIsInitialized(true);
    }
  }, [userSettings]);

  // Subscribe to local settings changes
  useEffect(() => {
    const unsubscribe = convexSettingsManager.subscribe(() => {
      // Schedule the state update in a microtask to avoid flushing during render
      Promise.resolve().then(() => {
        setSettings(convexSettingsManager.getAll());
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    // Update locally first for immediate UI feedback
    convexSettingsManager.updateSetting(key, value);

    // Sync to Convex if user is logged in and sync is enabled
    if (user?.id && userSettings?.settingsSync) {
      if (!authToken) {
        console.warn('Cannot sync settings without auth token');
        return;
      }
      try {
        const newSettings = { ...convexSettingsManager.getAll() };
        await updateSettingsMutation({
          userId: user.id as Id<"users">,
          authToken,
          settings: newSettings
        });
      } catch (error) {
        console.error('Failed to sync settings to Convex:', error);
        // Settings are still updated locally, user can try again
      }
    }
  }, [user?.id, userSettings?.settingsSync, authToken, updateSettingsMutation]);

  const toggleSync = useCallback(async (enabled: boolean) => {
    if (!user?.id) {
      throw new Error('User must be logged in to toggle settings sync');
    }

    if (!authToken) {
      throw new Error('Missing auth token while toggling settings sync');
    }

    try {
      const result = await toggleSyncMutation({
        userId: user.id as Id<"users">,
        authToken,
        enabled
      });


      if (enabled) {
        const hasServerSettings = !!(result && result.settings && Object.keys(result.settings).length > 0);
        if (hasServerSettings) {
          // Update local settings with server settings when enabling sync
          convexSettingsManager.updateFromConvex(result);
        } else {
          // Server has no settings (likely just cleared). Seed with current local settings
          const localSettings = { ...convexSettingsManager.getAll() };
          try {
            await updateSettingsMutation({
              userId: user.id as Id<"users">,
              authToken,
              settings: localSettings
            });
          } catch (seedErr) {
            console.error('Failed to seed server settings after enabling sync:', seedErr);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to toggle settings sync:', error);
      return false;
    }
  }, [user?.id, authToken, toggleSyncMutation, updateSettingsMutation]);

  return {
    settings,
    syncEnabled: userSettings?.settingsSync ?? false,
    isSyncing: false, // With Convex, syncing is instant
    isInitialized,
    updateSetting,
    toggleSync,
    getSetting: useCallback(<K extends keyof UserSettings>(key: K) => convexSettingsManager.get(key), []),
    getStorageValue: useCallback((key: keyof UserSettings) => convexSettingsManager.getStorageValue(key), []),
  };
}
