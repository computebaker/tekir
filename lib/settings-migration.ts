
import { useSettings } from "./settings";
import { trackClientLog } from "@/lib/posthog-analytics";

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
  trackClientLog('settings_migration_already_completed');
}
