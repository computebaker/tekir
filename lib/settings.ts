import { useAuth } from "@/components/auth-provider";
import { useCallback, useEffect, useState } from "react";

// Define the settings structure
export interface UserSettings {
  // Search preferences
  searchEngine?: string;
  searchCountry?: string;
  safesearch?: string;
  autocompleteSource?: string;
  
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
  
  // UI preferences
  theme?: string;
  searchType?: string;
  
  // AI model-specific settings
  karakulakEnabled_llama?: boolean;
  karakulakEnabled_gemini?: boolean;
  karakulakEnabled_chatgpt?: boolean;
  karakulakEnabled_mistral?: boolean;
}

// Default settings values
export const DEFAULT_SETTINGS: UserSettings = {
  searchEngine: "brave",
  searchCountry: "ALL",
  safesearch: "moderate",
  autocompleteSource: "brave",
  aiModel: "gemini",
  karakulakEnabled: true,
  clim8Enabled: true,
  weatherUnits: "metric",
  theme: "system",
  searchType: "web",
  karakulakEnabled_llama: true,
  karakulakEnabled_gemini: true,
  karakulakEnabled_chatgpt: true,
  karakulakEnabled_mistral: true,
};

class SettingsManager {
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<() => void> = new Set();
  private syncEnabled = false;
  private userId: string | null = null;
  private isSyncing = false;

  async initialize(userId?: string | null) {
    // Always re-initialize if userId changes, even if already initialized
    if (this.isInitialized && this.userId === userId) {
      console.log('Settings already initialized with same userId, skipping');
      return;
    }
    
    // If already initializing with different userId, wait for that to complete first
    if (this.initializationPromise) {
      await this.initializationPromise;
      // After previous initialization, check if we need to initialize again
      if (this.userId === userId) {
        return;
      }
    }
    
    // Reset state for re-initialization
    this.isInitialized = false;
    
    // Create initialization promise
    this.initializationPromise = this._doInitialize(userId);
    return this.initializationPromise;
  }

  private async _doInitialize(userId?: string | null) {
    console.log('Settings initialization - userId:', userId);
    this.userId = userId || null;
    
    // Check if settings sync is enabled
    if (this.userId) {
      try {
        const response = await fetch('/api/user/settings/sync');
        if (response.ok) {
          const data = await response.json();
          this.syncEnabled = data.settingsSync;
          
          if (this.syncEnabled && data.settings) {
            // Use synced settings
            this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
            // Also update localStorage for offline access
            this.saveToLocalStorage();
          } else {
            // Load from localStorage
            this.loadFromLocalStorage();
          }
        } else {
          this.loadFromLocalStorage();
        }
      } catch (error) {
        console.error('Failed to load synced settings:', error);
        this.loadFromLocalStorage();
      }
    } else {
      this.loadFromLocalStorage();
    }
    
    this.isInitialized = true;
    this.initializationPromise = null;
    console.log('Settings initialization complete - userId:', this.userId);
    this.notifyListeners();
  }

  private loadFromLocalStorage() {
    if (typeof window === 'undefined') return;
    
    // Load all settings from localStorage
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

  private async syncToServer() {
    if (!this.syncEnabled || !this.userId) return;
    
    this.isSyncing = true;
    this.notifyListeners();
    
    try {
      await fetch('/api/user/settings/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: this.settings }),
      });
    } catch (error) {
      console.error('Failed to sync settings to server:', error);
      throw error; // Re-throw so the caller can handle it
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // Public methods
  get<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key] ?? DEFAULT_SETTINGS[key];
  }

  async set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    // Immediately update settings in memory
    this.settings[key] = value;
    
    // Immediately save to localStorage for offline access
    this.saveToLocalStorage();
    
    // Immediately notify all listeners to update UI
    this.notifyListeners();
    
    // Sync to server in background (non-blocking)
    if (this.syncEnabled) {
      // Don't await - let it happen in background
      this.syncToServer().catch(error => {
        console.error('Background sync failed:', error);
        // Could implement retry logic or show a toast notification here
      });
    }
  }

  async setSyncEnabled(enabled: boolean) {
    // Wait for initialization to complete if it's still in progress
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    
    console.log('setSyncEnabled called - userId:', this.userId, 'enabled:', enabled);
    
    // If userId is still null, this could be a race condition - try to get current session
    if (!this.userId) {
      console.error('setSyncEnabled: userId is null, this suggests the session was not properly loaded during initialization');
      throw new Error('User must be logged in to enable settings sync');
    }
    
    try {
      const response = await fetch('/api/user/settings/sync/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.syncEnabled = data.settingsSync;
        
        if (enabled) {
          // Upload current settings to server
          await this.syncToServer();
        }
        
        this.notifyListeners();
        return true;
      } else {
        // Handle specific error cases
        if (response.status === 404) {
          const errorData = await response.json().catch(() => ({ error: 'User not found' }));
          throw new Error(errorData.error || 'User record not found. Please sign out and sign in again.');
        }
        return false;
      }
    } catch (error) {
      // Re-throw specific errors, log others
      if (error instanceof Error && error.message.includes('User record not found')) {
        throw error;
      }
      console.error('Failed to toggle settings sync:', error);
      return false;
    }
  }

  getSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAll(): UserSettings {
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

  // Method to update settings from server without full re-initialization
  updateSettingsFromServer(serverSettings: UserSettings) {
    const mergedSettings = { ...DEFAULT_SETTINGS, ...serverSettings };
    this.settings = mergedSettings;
    this.saveToLocalStorage();
    this.notifyListeners();
    console.log('Settings updated from server polling');
  }
}

// Global settings manager instance
export const settingsManager = new SettingsManager();

// React hook for using settings
export function useSettings() {
  const { user, status } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => settingsManager.getAll());
  const [syncEnabled, setSyncEnabledState] = useState(() => settingsManager.getSyncEnabled());
  const [isSyncing, setIsSyncing] = useState(() => settingsManager.getIsSyncing());
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastInitializedUserId, setLastInitializedUserId] = useState<string | null>(null);

  useEffect(() => {
    // Only initialize when auth status is not loading
    if (status === 'loading') {
      console.log('useSettings: auth still loading, waiting...');
      return;
    }

    // Only re-initialize if the user ID actually changed
    if (lastInitializedUserId === user?.id) {
      console.log('useSettings: user ID unchanged, skipping re-initialization');
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;

    // Initialize settings manager when user changes
    const initializeSettings = async () => {
      console.log('useSettings initialization - user:', user?.id, 'status:', status);
      await settingsManager.initialize(user?.id);
      setIsInitialized(true);
      setLastInitializedUserId(user?.id || null);

      // Start polling every 10 minutes if sync is enabled and user is logged in
      if (settingsManager.getSyncEnabled() && user?.id) {
        pollInterval = setInterval(async () => {
          console.log('Polling for latest settings from server...');
          // Just refresh settings, don't re-initialize completely
          try {
            const response = await fetch('/api/user/settings/sync');
            if (response.ok) {
              const data = await response.json();
              if (data.settings) {
                settingsManager.updateSettingsFromServer(data.settings);
              }
            }
          } catch (error) {
            console.error('Failed to poll settings:', error);
          }
        }, 600000); // 10 minutes
      }
    };

    setIsInitialized(false);
    initializeSettings();

    // Subscribe to settings changes
    const unsubscribe = settingsManager.subscribe(() => {
      setSettings(settingsManager.getAll());
      setSyncEnabledState(settingsManager.getSyncEnabled());
      setIsSyncing(settingsManager.getIsSyncing());
    });

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user?.id, status, lastInitializedUserId]); 

  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    await settingsManager.set(key, value);
  }, []);

  const toggleSync = useCallback(async (enabled: boolean) => {
    return await settingsManager.setSyncEnabled(enabled);
  }, []);

  return {
    settings,
    syncEnabled,
    isSyncing,
    isInitialized,
    updateSetting,
    toggleSync,
    getSetting: useCallback(<K extends keyof UserSettings>(key: K) => settingsManager.get(key), []),
    getStorageValue: useCallback((key: keyof UserSettings) => settingsManager.getStorageValue(key), []),
  };
}
