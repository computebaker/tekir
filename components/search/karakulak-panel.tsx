import { Cat, ChevronDown, ExternalLink, Sparkles } from "lucide-react";

interface KarakulakPanelProps {
  aiResponse: string | null;
  diveResponse: string | null;
  diveSources: Array<{ url: string, title: string, description?: string }>;
  aiLoading: boolean;
  diveLoading: boolean;
  aiError: boolean;
  diveError: boolean;
  karakulakCollapsed: boolean;
  aiDiveEnabled: boolean;
  karakulakName: string;
  betaLabel: string;
  fetchingWebSources: string;
  processingRequest: string;
  diveDisclaimer: string;
  aiDisclaimer: string;
  onToggleDive: () => void;
  onToggleCollapse: () => void;
  onDismissError: () => void;
}

export function KarakulakPanel({
  aiResponse,
  diveResponse,
  diveSources,
  aiLoading,
  diveLoading,
  aiError,
  diveError,
  karakulakCollapsed,
  aiDiveEnabled,
  karakulakName,
  betaLabel,
  fetchingWebSources,
  processingRequest,
  diveDisclaimer,
  aiDisclaimer,
  onToggleDive,
  onToggleCollapse,
  onDismissError,
}: KarakulakPanelProps) {
  const showKarakulak = !!(aiResponse || diveResponse || aiLoading || diveLoading);
  const activeResponse = diveResponse || aiResponse;
  const hasSomething = showKarakulak && activeResponse;
  const isLoading = aiLoading || diveLoading;

  if (!hasSomething && !isLoading) return null;

  return (
    <div className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
            {karakulakName}
            <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
              {betaLabel}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDive}
            className={`relative p-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center overflow-hidden ${aiDiveEnabled
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 ring-2 ring-blue-400 ring-offset-2 ring-offset-background'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md'
              }`}
            title={aiDiveEnabled ? "Disable Dive mode" : "Enable Dive mode"}
          >
            <Sparkles className={`w-5 h-5 transition-all duration-300 relative z-10 ${aiDiveEnabled ? 'drop-shadow-lg' : 'hover:scale-110'}`} />
            {aiDiveEnabled && (
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 via-blue-300/30 to-blue-400/20 animate-pulse"></div>
            )}
          </button>

          <button
            onClick={onToggleCollapse}
            aria-expanded={!karakulakCollapsed}
            title={karakulakCollapsed ? 'Expand Karakulak' : 'Collapse Karakulak'}
            className="px-2 py-1 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${karakulakCollapsed ? 'rotate-180' : ''}`} />
            <span className="sr-only">{karakulakCollapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </div>

      {(aiLoading || diveLoading) ? (
        <div className="animate-pulse space-y-2">
          <div className="flex items-center gap-2 text-xs text-blue-600/70 dark:text-blue-300/70">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span>{aiDiveEnabled ? fetchingWebSources : processingRequest}</span>
          </div>
          <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-1/2 mb-3"></div>
        </div>
      ) : (
        <>
          <p className={`text-left text-blue-800 dark:text-blue-100 mb-3 ${karakulakCollapsed ? 'line-clamp-2' : ''}`}>
            {diveResponse || aiResponse}
          </p>

          <div
            className="overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
            style={{ maxHeight: karakulakCollapsed ? 0 : 1000, opacity: karakulakCollapsed ? 0 : 1, transform: karakulakCollapsed ? 'translateY(-6px)' : 'translateY(0px)' }}
            aria-hidden={karakulakCollapsed}
          >
            {diveSources && diveSources.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {diveSources.map((source, index) => (
                    <a
                      key={index}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 text-sm hover:bg-blue-200 dark:hover:bg-blue-800/70 transition-colors"
                      title={source.description}
                    >
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center mr-2">
                        {index + 1}
                      </span>
                      <span className="truncate max-w-[150px]">{source.title}</span>
                      <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(diveResponse || aiResponse) ? (
              <p className="text-sm text-blue-600/70 dark:text-blue-300/70 mb-4">
                {aiDiveEnabled
                  ? diveDisclaimer
                  : aiDisclaimer
                }
              </p>
            ) : null}

          </div>
        </>
      )}
    </div>
  );
}
