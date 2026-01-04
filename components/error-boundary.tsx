"use client"

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { trackJSError } from "@/lib/posthog-analytics";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We apologize for the inconvenience. An unexpected error occurred.
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === "development" && error.message && (
          <details className="text-left bg-muted p-4 rounded-lg">
            <summary className="cursor-pointer font-medium text-sm mb-2">
              Error Details
            </summary>
            <pre className="text-xs overflow-auto text-destructive">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={resetError}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>

        {/* Support Link */}
        <p className="text-sm text-muted-foreground">
          If the problem persists, please{" "}
          <a
            href="https://github.com/computebaker/tekir/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            report the issue
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Respects user privacy - only sends error reports if analytics consent is granted.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development only
    if (process.env.NODE_ENV === 'development') {
      console.error("Error Boundary caught an error:", error, errorInfo);
    }

    // Track error in PostHog (only if user has consented)
    trackJSError({
      error_type: error.name || 'Error',
      error_message: error.message,
      component: errorInfo.componentStack?.split('\n')[0]?.trim() || 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });

    // Show toast notification
    showToast.error(
      "Something went wrong",
      "An unexpected error occurred. We're sorry for the inconvenience."
    );

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}

/**
 * Hook to track errors manually with consent check
 * Use this in try-catch blocks where you want to report errors
 */
export function useErrorTracking() {
  return (error: Error, context?: string) => {
    trackJSError({
      error_type: error.name || 'Error',
      error_message: error.message,
      component: context || 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  };
}
