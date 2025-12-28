import { handleApiError } from "@/lib/toast";

/**
 * Standard API response shape
 */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public context?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch wrapper with automatic error handling and toast notifications
 */
export async function fetchWithErrorHandling<T = ApiResponse>(
  url: string,
  options?: RequestInit & { showErrorToast?: boolean; errorContext?: string }
): Promise<T> {
  const { showErrorToast = true, errorContext, ...fetchOptions } = options || {};

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new ApiError(
        data.error || data.message || "Request failed",
        response.status,
        errorContext
      );

      if (showErrorToast) {
        handleApiError(error, errorContext || url);
      }

      throw error;
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (showErrorToast) {
      handleApiError(error, errorContext || url);
    }

    throw error;
  }
}

/**
 * Parse error from various sources
 */
export function parseError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  if (error && typeof error === "object" && "error" in error) {
    return String((error as { error: string }).error);
  }

  return "An unexpected error occurred";
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  const parsed = parseError(error).toLowerCase();

  if (parsed.includes("network") || parsed.includes("fetch")) {
    return "Network error. Please check your connection.";
  }

  if (parsed.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  if (parsed.includes("401") || parsed.includes("unauthorized")) {
    return "You need to sign in to continue.";
  }

  if (parsed.includes("403") || parsed.includes("forbidden")) {
    return "You don't have permission to do this.";
  }

  if (parsed.includes("404") || parsed.includes("not found")) {
    return "The requested resource was not found.";
  }

  if (parsed.includes("429") || parsed.includes("too many")) {
    return "Too many requests. Please wait a moment.";
  }

  if (parsed.includes("500") || parsed.includes("server error")) {
    return "Server error. Please try again later.";
  }

  return parseError(error);
}
