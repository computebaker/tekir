"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Shield, Eye, EyeOff, Info, Trash2, CheckCircle2, BarChart3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsShell, type SettingsNavItem, type MobileNavItem } from "@/components/settings/settings-shell";
import { useSettings } from "@/lib/settings";
import { analytics, trackAnalyticsConsentChanged } from "@/lib/posthog-analytics";
import { enableAnalytics, enableSessionReplay } from "@/instrumentation-client";
import { showToast } from "@/lib/toast";

export default function AnalyticsSettingsPage() {
  const tSettings = useTranslations("settings");

  const { settings, updateSetting } = useSettings();

  const analyticsEnabled = settings.analyticsEnabled ?? false;
  const sessionReplayEnabled = settings.sessionReplayEnabled ?? false;

  const mobileNavItems: MobileNavItem[] = [
    {
      href: "/",
      icon: Search,
      label: "Back to Search",
    },
  ];

  const sidebarItems: SettingsNavItem[] = [
    { href: "/settings/search", icon: Search, label: tSettings("search") },
    { href: "/settings/account", icon: Eye, label: tSettings("account") },
    { href: "/settings/privacy", icon: Shield, label: tSettings("privacy") },
    { href: "/settings/analytics", icon: BarChart3, label: tSettings("analytics"), active: true },
    { href: "/settings/about", icon: Info, label: tSettings("about") },
  ];

  // Handle analytics toggle
  const handleAnalyticsToggle = async (enabled: boolean) => {
    await updateSetting('analyticsEnabled', enabled);

    // Enable/disable analytics via instrumentation client (starts web vitals, scroll tracking, etc.)
    enableAnalytics(enabled);

    // Track consent change (this event is captured regardless of consent)
    trackAnalyticsConsentChanged(enabled);

    if (enabled) {
      showToast.success(
        "Analytics Enabled",
        "Thank you for helping us improve Tekir."
      );
    } else {
      showToast.success(
        "Analytics Disabled",
        "Your analytics preference has been saved."
      );
    }
  };

  // Handle session replay toggle
  const handleSessionReplayToggle = async (enabled: boolean) => {
    // Session replay requires analytics to be enabled
    if (enabled && !analyticsEnabled) {
      showToast.error(
        "Session Replay Requires Analytics",
        "Please enable analytics first."
      );
      return;
    }

    await updateSetting('sessionReplayEnabled', enabled);

    // Enable/disable session replay via instrumentation client
    enableSessionReplay(enabled);

    if (enabled) {
      showToast.success(
        "Session Replay Enabled",
        "Session recording is now enabled."
      );
    }
  };

  // Clear all analytics data
  const handleClearData = () => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.reset();
      localStorage.removeItem('analyticsEnabled');
      localStorage.removeItem('sessionReplayEnabled');
      showToast.success(
        "Local Data Cleared",
        "Local analytics identifiers have been reset."
      );
    }
  };

  // Set page title
  useState(() => {
    if (typeof document !== 'undefined') {
      document.title = `Analytics Settings | Tekir`;
    }
  });

  return (
    <SettingsShell
      title={tSettings("title")}
      currentSectionLabel={tSettings("analytics")}
      sidebar={sidebarItems}
      mobileNavItems={mobileNavItems}
    >
      <div className="space-y-8">
        {/* Page Title and Description */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Settings</h2>
          <p className="text-muted-foreground mt-2">
            Manage your analytics preferences and control what data is collected.
          </p>
        </div>

        {/* Current Status Card */}
        <div className={`rounded-lg border p-6 ${
          analyticsEnabled
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
            : 'bg-muted border-border'
        }`}>
          <div className="flex items-start gap-4">
            {analyticsEnabled ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
            ) : (
              <EyeOff className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">
                {analyticsEnabled
                  ? "Analytics Enabled"
                  : "Analytics Disabled"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {analyticsEnabled
                  ? "You're helping us improve Tekir by sharing anonymous usage data."
                  : "No analytics data is being collected. Tekir works perfectly without analytics."}
              </p>

              {/* Main Analytics Toggle */}
              <div className="flex items-center justify-between py-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="analytics-toggle" className="font-medium">
                      Enable Analytics
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Help us improve Tekir by sharing anonymous usage data
                    </p>
                  </div>
                </div>
                <Switch
                  id="analytics-toggle"
                  checked={analyticsEnabled}
                  onChange={(e) => handleAnalyticsToggle(e.target.checked)}
                />
              </div>

              {/* Session Replay Toggle */}
              {analyticsEnabled && (
                <div className="flex items-center justify-between py-4 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="replay-toggle" className="font-medium">
                        Session Replay
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow session recording for debugging purposes
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="replay-toggle"
                    checked={sessionReplayEnabled}
                    onChange={(e) => handleSessionReplayToggle(e.target.checked)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What We Track Card */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            What We Track
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                When Analytics is Enabled
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>Page views and navigation patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>Search behavior (filters, tabs used)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>AI usage and response times</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>Errors and crashes for debugging</span>
                </li>
                {sessionReplayEnabled && (
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                    <span>Session recordings for troubleshooting</span>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-red-600 dark:text-red-400 flex items-center gap-2">
                <EyeOff className="w-4 h-4" />
                Never Tracked
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>Your search queries (remains private)</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>Personal information (name, email)</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>Clicked result URLs (what you click on)</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>Third-party tracking cookies</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>Data is never sold to advertisers</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Why We Collect Data */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold text-lg mb-4">Why We Collect Analytics</h3>
          <p className="text-muted-foreground mb-4">
            Analytics help us understand how Tekir is being used so we can make it better for everyone.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>Improve search accuracy and relevance</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>Fix bugs and crashes quickly</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>Understand which features are most valuable</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>Optimize performance across devices</span>
            </li>
          </ul>
        </div>

        {/* Data Management */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-muted-foreground" />
            Data Management
          </h3>
          <p className="text-muted-foreground mb-6">
            You can clear your local analytics identifiers at any time. This resets the random ID associated
            with your device. To request deletion of server-side data, please contact us.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="destructive"
              onClick={handleClearData}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear Local Analytics Data
            </Button>
            <a
              href="mailto:support@tekir.co?subject=Delete%20My%20Analytics%20Data"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-background hover:bg-muted rounded-md text-sm font-medium transition-colors"
            >
              <Shield className="w-4 h-4" />
              Request Server Data Deletion
            </a>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-6">
          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Info className="w-5 h-5" />
            Privacy Notice
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Analytics are completely optional. Tekir functions fully without any data collection.
            If you change your mind later, you can disable analytics at any time from this page.
            We respect your privacy and will never sell your data to third parties.
          </p>
        </div>
      </div>
    </SettingsShell>
  );
}
