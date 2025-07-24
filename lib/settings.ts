// This file has been migrated to Convex real-time sync
// All settings functionality now uses the Convex-based implementation

export { 
  useConvexSettings as useSettings,
  DEFAULT_SETTINGS,
  convexSettingsManager as settingsManager
} from './convex-settings';

export type { UserSettings } from './convex-settings';
