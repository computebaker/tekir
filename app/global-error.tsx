'use client';

import { useEffect } from "react";
import { trackJSError } from "@/lib/posthog-analytics";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    trackJSError({
      error_type: error.name || 'GlobalError',
      error_message: error.message,
      component: 'app/global-error',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      user_action: error.digest ? `fatal_digest:${error.digest}` : 'fatal',
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-12 w-12 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            
            <h2 className="mb-2 text-2xl font-bold">Critical Error</h2>
            
            <p className="mb-6 text-muted-foreground">
              A critical error occurred. Please refresh the page or contact support if the problem persists.
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6 rounded-lg bg-muted p-4 text-left text-sm">
                <summary className="cursor-pointer font-semibold">Error Details</summary>
                <pre className="mt-2 overflow-auto text-xs">
                  {error.message}
                  {error.stack && '\n\n' + error.stack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Refresh Page
              </button>
              
              <a
                href="/"
                className="rounded-md border border-input bg-background px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
