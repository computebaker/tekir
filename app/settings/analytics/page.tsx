"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Shield, Eye, EyeOff, Info, CheckCircle2, User, BarChart3, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsShell, type SettingsNavItem, type MobileNavItem } from "@/components/settings/settings-shell";
import { useSettings } from "@/lib/settings";
import { analytics, trackAnalyticsConsentChanged } from "@/lib/posthog-analytics";
import { enableAnalytics, enableSessionReplay } from "@/instrumentation-client";
import { showToast } from "@/lib/toast";

export default function AnalyticsSettingsPage() {
  const tSettings = useTranslations("settings");
  const tAnalytics = useTranslations("settings.analyticsPage");
  const tToasts = useTranslations("settings.toasts");

  const { settings, updateSetting } = useSettings();

  const analyticsEnabled = settings.analyticsEnabled ?? true;
  const sessionReplayEnabled = settings.sessionReplayEnabled ?? false;

  const mobileNavItems: MobileNavItem[] = [
    {
      href: "/",
      icon: Search,
      label: tAnalytics("mobileNav.back"),
    },
  ];

  const sidebarItems: SettingsNavItem[] = [
    { href: "/settings/search", icon: Search, label: tSettings("search") },
    { href: "/settings/account", icon: User, label: tSettings("account") },
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
        tToasts("analyticsEnabled.title"),
        tToasts("analyticsEnabled.description")
      );
    } else {
      showToast.success(
        tToasts("analyticsDisabled.title"),
        tToasts("analyticsDisabled.description")
      );
    }
  };

  // Handle session replay toggle
  const handleSessionReplayToggle = async (enabled: boolean) => {
    // Session replay requires analytics to be enabled
    if (enabled && !analyticsEnabled) {
      showToast.error(
        tToasts("sessionReplayRequiresAnalytics.title"),
        tToasts("sessionReplayRequiresAnalytics.description")
      );
      return;
    }

    await updateSetting('sessionReplayEnabled', enabled);

    // Enable/disable session replay via instrumentation client
    enableSessionReplay(enabled);

    if (enabled) {
      showToast.success(
        tToasts("sessionReplayEnabled.title"),
        tToasts("sessionReplayEnabled.description")
      );
    }
  };

  // Set page title
  useState(() => {
    if (typeof document !== 'undefined') {
      document.title = `${tAnalytics("metaTitle")} | Tekir`;
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
          <h2 className="text-3xl font-bold tracking-tight">{tAnalytics("pageTitle")}</h2>
          <p className="text-muted-foreground mt-2">
            {tAnalytics("pageDescription")}
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
                  ? tAnalytics("status.enabled")
                  : tAnalytics("status.disabled")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {analyticsEnabled
                  ? tAnalytics("status.enabledDescription")
                  : tAnalytics("status.disabledDescription")}
              </p>

              {/* Main Analytics Toggle */}
              <div className="flex items-center justify-between py-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="analytics-toggle" className="font-medium">
                      {tAnalytics("toggle.analytics")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {tAnalytics("toggle.analyticsDescription")}
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
                        {tAnalytics("toggle.sessionReplay")}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {tAnalytics("toggle.sessionReplayDescription")}
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
            {tAnalytics("sections.whatWeTrack")}
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {tAnalytics("sections.whenEnabled")}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>{tAnalytics("trackedItems.pageViews")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>{tAnalytics("trackedItems.searchBehavior")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>{tAnalytics("trackedItems.aiUsage")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>{tAnalytics("trackedItems.errors")}</span>
                </li>
                {sessionReplayEnabled && (
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                    <span>{tAnalytics("trackedItems.sessionRecording")}</span>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-red-600 dark:text-red-400 flex items-center gap-2">
                <EyeOff className="w-4 h-4" />
                {tAnalytics("sections.neverTracked")}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>{tAnalytics("neverTrackedItems.searchQueries")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>{tAnalytics("neverTrackedItems.personalInfo")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>{tAnalytics("neverTrackedItems.clickedUrls")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>{tAnalytics("neverTrackedItems.trackingCookies")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>{tAnalytics("neverTrackedItems.dataSold")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Why We Collect Data */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold text-lg mb-4">{tAnalytics("sections.whyCollect")}</h3>
          <p className="text-muted-foreground mb-4">
            {tAnalytics("whyCollectDescription")}
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {tAnalytics.raw("whyCollectPoints").map((point: string, index: number) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Privacy Notice */}
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-6">
          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Info className="w-5 h-5" />
            {tAnalytics("sections.privacyNotice")}
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {tAnalytics("privacyNotice")}
          </p>
        </div>
      </div>
    </SettingsShell>
  );
}
