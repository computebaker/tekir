"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Shield,
  Search,
  User,
  Download,
  Upload,
  FileText,
  Cloud,
  List,
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  Info,
} from "lucide-react";
import { SettingsShell, type SettingsNavItem, type MobileNavItem } from "@/components/settings/settings-shell";
import { useSettings, type UserSettings } from "@/lib/settings";
import { useAuth } from "@/components/auth-provider";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const EXPORT_FILENAME = "settings.tekir.json";

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
    | "karakulakEnabled_grok"
    | "selectedLogo"
  >;
};

export default function PrivacySettingsPage() {
  const { user } = useAuth();
  const { settings, updateSetting } = useSettings();
  const tSettings = useTranslations("settings");
  const tPrivacy = useTranslations("settings.privacyPage");

  // Server-side data overview using Convex
  const userId = user?.id as Id<"users"> | undefined;
  const serverSettings = useQuery(api.settings.getUserSettings, userId ? { userId } : "skip");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const mobileNavItems: MobileNavItem[] = [
    { href: "/search", icon: Search, label: tPrivacy("mobileNav.back") },
    { href: "/settings/account", icon: User, label: tPrivacy("mobileNav.account") },
  ];

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    document.title = `${tPrivacy("metaTitle")} | Tekir`;
  }, [tPrivacy]);

  const sidebarItems: SettingsNavItem[] = [
    { href: "/settings/search", icon: Search, label: tSettings("search") },
    { href: "/settings/account", icon: User, label: tSettings("account") },
    { href: "/settings/privacy", icon: Shield, label: tSettings("privacy"), active: true },
    { href: "/settings/about", icon: Info, label: tSettings("about") },
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
      karakulakEnabled_grok: settings.karakulakEnabled_grok,
      selectedLogo: settings.selectedLogo,
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
      a.download = EXPORT_FILENAME;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: tPrivacy("messages.exportSuccess", { file: EXPORT_FILENAME }) });
    } catch (e) {
      setMessage({ type: "error", text: tPrivacy("messages.exportError") });
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
        throw new Error(tPrivacy("messages.importInvalidKind"));
      }
      if (!parsed.preferences || typeof parsed.preferences !== "object") {
        throw new Error(tPrivacy("messages.importInvalidPreferences"));
      }
      await applyImportedPreferences(parsed.preferences);
      setMessage({ type: "success", text: tPrivacy("messages.importSuccess") });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : tPrivacy("messages.importParseError"),
      });
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
    <SettingsShell
      title={tSettings("title")}
      currentSectionLabel={tSettings("privacy")}
      sidebar={sidebarItems}
      mobileNavItems={mobileNavItems}
    >
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
          <h2 className="text-3xl font-bold tracking-tight">{tPrivacy("pageTitle")}</h2>
          <p className="text-muted-foreground mt-2">{tPrivacy("pageDescription")}</p>
        </div>

        {/* Server Data Overview */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">{tPrivacy("sections.serverOverview.title")}</h3>
          </div>
          {!user ? (
            <p className="text-sm text-muted-foreground">{tPrivacy("sections.serverOverview.signInPrompt")}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>{tPrivacy("sections.serverOverview.fields.email")}</span>
                <span className="ml-auto text-muted-foreground">{user.email || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>{tPrivacy("sections.serverOverview.fields.name")}</span>
                <span className="ml-auto text-muted-foreground">{user.name || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>{tPrivacy("sections.serverOverview.fields.username")}</span>
                <span className="ml-auto text-muted-foreground">{user.username || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                {serverSummary?.settingsSync ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span>{tPrivacy("sections.serverOverview.fields.settingsSync")}</span>
                <span className="ml-auto text-muted-foreground">
                  {serverSummary?.settingsSync
                    ? tPrivacy("sections.serverOverview.values.enabled")
                    : tPrivacy("sections.serverOverview.values.disabled")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-muted-foreground" />
                <span>{tPrivacy("sections.serverOverview.fields.serverPreferences")}</span>
                <span className="ml-auto text-muted-foreground">
                  {serverSummary?.serverHasSettings
                    ? tPrivacy("sections.serverOverview.values.present")
                    : tPrivacy("sections.serverOverview.values.none")}
                </span>
              </div>
              {serverSummary?.updatedAt && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>{tPrivacy("sections.serverOverview.fields.lastUpdated")}</span>
                  <span className="ml-auto text-muted-foreground">{serverSummary.updatedAt}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            {tPrivacy("sections.serverOverview.privacyNote")}
          </p>
        </div>

        {/* Server-stored Preferences JSON */}
        {user && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-medium">{tPrivacy("sections.serverJson.title")}</h3>
              </div>
              <button
                onClick={handleCopyServerSettings}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
                aria-label={tPrivacy("sections.serverJson.copyAria")}
              >
                <ClipboardCopy className="w-4 h-4" />
                {copied ? tPrivacy("sections.serverJson.copyButtonCopied") : tPrivacy("sections.serverJson.copyButton")}
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
              <h3 className="text-lg font-medium">{tPrivacy("sections.transfer.title")}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md border">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Download className="w-4 h-4" />
                {tPrivacy("sections.transfer.export.title")}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {tPrivacy("sections.transfer.export.description", { file: EXPORT_FILENAME })}
              </p>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                aria-label={tPrivacy("sections.transfer.export.ariaLabel")}
              >
                <Download className="w-4 h-4" />
                {tPrivacy("sections.transfer.export.button")}
              </button>
            </div>

            <div className="p-4 rounded-md border">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {tPrivacy("sections.transfer.import.title")}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {tPrivacy("sections.transfer.import.description", { file: EXPORT_FILENAME })}
              </p>
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
                aria-label={tPrivacy("sections.transfer.import.ariaLabel")}
              >
                <Upload className="w-4 h-4" />
                {tPrivacy("sections.transfer.import.button")}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {tPrivacy("sections.transfer.hint", { file: EXPORT_FILENAME })}
          </p>
        </div>
      </div>
    </SettingsShell>
  );
}
