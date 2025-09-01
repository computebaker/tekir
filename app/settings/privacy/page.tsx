"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shield, Search, User, Download, Upload, FileText, Cloud, List, AlertCircle, CheckCircle2, ClipboardCopy } from "lucide-react";
import { SettingsShell, type SettingsNavItem, type MobileNavItem } from "@/components/settings/settings-shell";
import { useSettings, type UserSettings } from "@/lib/settings";
import { useAuth } from "@/components/auth-provider";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Mobile nav items (consistent with other settings pages)
const settingsMobileNavItems: MobileNavItem[] = [
  { href: "/search", icon: Search, label: "Back to Search" },
  { href: "/settings/account", icon: User, label: "Account" },
];

type ExportPayload = {
  version: string; // for future compatibility
  kind: "tekir.settings";
  exportedAt: string; // ISO date
  preferences: Pick<
    UserSettings,
    | "searchEngine"
    | "searchCountry"
    | "safesearch"
    | "autocompleteSource"
    | "showRecommendations"
    | "aiModel"
    | "karakulakEnabled"
    | "clim8Enabled"
    | "weatherUnits"
    | "customWeatherLocation"
    | "weatherPlacement"
    | "theme"
    | "searchType"
    | "enchantedResults"
    | "wikipediaEnabled"
    | "karakulakEnabled_llama"
    | "karakulakEnabled_gemini"
    | "karakulakEnabled_chatgpt"
    | "karakulakEnabled_mistral"
  >;
};

export default function PrivacySettingsPage() {
  const { user } = useAuth();
  const { settings, updateSetting } = useSettings();

  // Server-side data overview using Convex
  const userId = user?.id as Id<"users"> | undefined;
  const serverSettings = useQuery(api.settings.getUserSettings, userId ? { userId } : "skip");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    document.title = "Privacy Settings | Tekir";
  }, []);

  const sidebarItems: SettingsNavItem[] = [
    { href: "/settings/search", icon: Search, label: "Search" },
    { href: "/settings/account", icon: User, label: "Account" },
    { href: "/settings/privacy", icon: Shield, label: "Privacy", active: true },
  ];

  // Build export payload from current settings (search preferences only)
  const buildExport = (): ExportPayload => {
    const preferences = {
      searchEngine: settings.searchEngine,
      searchCountry: settings.searchCountry,
      safesearch: settings.safesearch,
      autocompleteSource: settings.autocompleteSource,
      showRecommendations: settings.showRecommendations,
      aiModel: settings.aiModel,
      karakulakEnabled: settings.karakulakEnabled,
      clim8Enabled: settings.clim8Enabled,
      weatherUnits: settings.weatherUnits,
      customWeatherLocation: settings.customWeatherLocation,
      weatherPlacement: settings.weatherPlacement,
      theme: settings.theme,
      searchType: settings.searchType,
      enchantedResults: settings.enchantedResults,
      wikipediaEnabled: settings.wikipediaEnabled,
      karakulakEnabled_llama: settings.karakulakEnabled_llama,
      karakulakEnabled_gemini: settings.karakulakEnabled_gemini,
      karakulakEnabled_chatgpt: settings.karakulakEnabled_chatgpt,
      karakulakEnabled_mistral: settings.karakulakEnabled_mistral,
    } satisfies ExportPayload["preferences"];

    return {
      version: "1",
      kind: "tekir.settings",
      exportedAt: new Date().toISOString(),
      preferences,
    };
  };

  const handleExport = () => {
    try {
      const payload = buildExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "settings.tekir.json";
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "Preferences exported to settings.tekir.json" });
    } catch (e) {
      setMessage({ type: "error", text: "Failed to export settings" });
    }
  };

  const applyImportedPreferences = async (prefs: ExportPayload["preferences"]) => {
    // Only update known keys using updateSetting to respect sync flow
    const entries = Object.entries(prefs) as [keyof ExportPayload["preferences"], any][];
    for (const [key, value] of entries) {
      try {
        await updateSetting(key as keyof UserSettings, value as any);
      } catch (err) {
        // continue applying others
        console.warn("Failed to apply setting", key, err);
      }
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<ExportPayload>;
      if (parsed?.kind !== "tekir.settings") {
        throw new Error("Invalid file format: expected tekir.settings file");
      }
      if (!parsed.preferences || typeof parsed.preferences !== 'object') {
        throw new Error("Invalid file format: missing or invalid preferences");
      }
      await applyImportedPreferences(parsed.preferences);
      setMessage({ type: "success", text: "Preferences imported successfully" });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to parse import file" });
    }
  };

  // Server data summary
  const serverSummary = useMemo(() => {
    if (!user) return null;
    return {
      email: user.email,
      username: user.username,
      settingsSync: !!serverSettings?.settingsSync,
    serverHasSettings: !!(serverSettings && serverSettings.settings && Object.keys(serverSettings.settings).length > 0),
      updatedAt: serverSettings?.updatedAt ? new Date(serverSettings.updatedAt).toLocaleString() : undefined,
    };
  }, [user, serverSettings]);

  const serverSettingsJson = useMemo(() => {
    try {
      return serverSettings?.settings ? JSON.stringify(serverSettings.settings, null, 2) : "{}";
    } catch {
      return "{}";
    }
  }, [serverSettings]);

  const handleCopyServerSettings = async () => {
    try {
      await navigator.clipboard.writeText(serverSettingsJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <SettingsShell title="Settings" currentSectionLabel="Privacy" sidebar={sidebarItems} mobileNavItems={settingsMobileNavItems}>
      {message && (
        <div className={`mb-6 p-3 rounded-md border text-sm ${
          message.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Privacy</h2>
          <p className="text-muted-foreground mt-2">See what we store and control your search preferences export/import.</p>
        </div>

        {/* Server Data Overview */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Your Data on Tekir Servers</h3>
          </div>
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to view your server-stored data overview.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Email:</span>
                <span className="ml-auto text-muted-foreground">{user.email || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Name:</span>
                <span className="ml-auto text-muted-foreground">{user.name || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Username:</span>
                <span className="ml-auto text-muted-foreground">{user.username || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                {serverSummary?.settingsSync ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span>Settings Sync:</span>
                <span className="ml-auto text-muted-foreground">{serverSummary?.settingsSync ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-muted-foreground" />
                <span>Server Preferences:</span>
                <span className="ml-auto text-muted-foreground">{serverSummary?.serverHasSettings ? "Present" : "None"}</span>
              </div>
              {serverSummary?.updatedAt && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>Last Updated:</span>
                  <span className="ml-auto text-muted-foreground">{serverSummary.updatedAt}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            We store only what’s needed to provide your experience. No analytics, no tracking. Account details aren’t included in export/import; only search preferences are. Your privacy is our priority.
          </p>
        </div>

        {/* Server-stored Preferences JSON */}
        {user && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-medium">Server-stored Preferences (JSON)</h3>
              </div>
              <button
                onClick={handleCopyServerSettings}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
                aria-label="Copy JSON"
              >
                <ClipboardCopy className="w-4 h-4" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-72">
{serverSettingsJson}
            </pre>
          </div>
        )}

  {/* Recent chats section removed during phase-out */}

        {/* Export / Import */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-medium">Export / Import Preferences</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md border">
              <h4 className="font-medium mb-2 flex items-center gap-2"><Download className="w-4 h-4" /> Export</h4>
              <p className="text-sm text-muted-foreground mb-3">Download your current search preferences as settings.tekir.json.</p>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                aria-label="Export preferences"
              >
                <Download className="w-4 h-4" />
                Export preferences
              </button>
            </div>

            <div className="p-4 rounded-md border">
              <h4 className="font-medium mb-2 flex items-center gap-2"><Upload className="w-4 h-4" /> Import</h4>
              <p className="text-sm text-muted-foreground mb-3">Import preferences from a settings.tekir.json file. This won’t change your account details.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files?.[0])}
              />
              <button
                onClick={handleImportClick}
                className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
                aria-label="Import preferences"
              >
                <Upload className="w-4 h-4" />
                Import from file
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Supported file: settings.tekir.json (kind: tekir.settings, version: 1). Only search preferences are applied.</p>
        </div>
      </div>
    </SettingsShell>
  );
}
