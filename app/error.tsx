"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture exception to PostHog
    posthog.captureException(error, {
      $exception_type: error.name,
      $exception_message: error.message,
      $exception_stack: error.stack,
      $exception_digest: error.digest,
    });
  }, [error]);

  return (
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
        
        <h2 className="mb-2 text-2xl font-bold">Something went wrong!</h2>
        
        <p className="mb-6 text-muted-foreground">
          An unexpected error occurred. We've been notified and are working on it.
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
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          
          <a
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
