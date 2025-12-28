"use client"

import React, { ComponentType } from "react";
import { ErrorBoundary, ErrorFallbackProps } from "@/components/error-boundary";

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: ComponentType<ErrorFallbackProps>;
}

/**
 * Higher-Order Component that wraps a component with error boundary
 * and provides reset functionality
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  fallback?: ComponentType<ErrorFallbackProps>
): ComponentType<P> {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook to handle async errors in components
 * Usage:
 * const { handleError } = useAsyncError();
 *
 * try {
 *   await fetchData();
 * } catch (error) {
 *   handleError(error);
 * }
 */
export function useAsyncError() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = (error: unknown) => {
    if (error instanceof Error) {
      setError(error);
    } else {
      setError(new Error(String(error)));
    }
  };

  const reset = () => {
    setError(null);
  };

  if (error) {
    throw error;
  }

  return { handleError, reset };
}
