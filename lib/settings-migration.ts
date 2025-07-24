
import { useSettings } from "./settings";

// Migration is complete - always use Convex settings
export function useMigratedSettings() {
  return useSettings();
}

export const settingsFeatureFlags = {
  useConvexRealTimeSync: true,
  useConvexMutations: true,
  useConvexQueries: true,
  migrationCompleted: true,
};

export function enableConvexSettings() {
  console.log('Migration already completed - Convex settings are active');
}
