import { toast } from "sonner";

/**
 * Toast utility functions for consistent error and success messages
 */
export const showToast = {
  success: (message: string, description?: string) => {
    return toast.success(message, description ? { description } : undefined);
  },

  error: (message: string, description?: string) => {
    return toast.error(message, description ? { description } : undefined);
  },

  info: (message: string, description?: string) => {
    return toast.info(message, description ? { description } : undefined);
  },

  warning: (message: string, description?: string) => {
    return toast.warning(message, description ? { description } : undefined);
  },

  /**
   * Show a loading toast that can be updated later
   */
  loading: (message: string) => {
    return toast.loading(message);
  },

  /**
   * Dismiss a toast by ID
   */
  dismiss: (id?: string | number) => {
    toast.dismiss(id);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    toast.dismiss();
  },
};

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown, context?: string): void {
  console.error(`[API Error${context ? ` - ${context}` : ''}]:`, error);

  let message = "An unexpected error occurred";
  let description = "Please try again later";

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object" && "message" in error) {
    message = (error as { message: string }).message;
  }

  // Check for common error patterns
  if (message.includes("fetch") || message.includes("network")) {
    description = "Please check your internet connection and try again";
  } else if (message.includes("timeout")) {
    description = "The request took too long. Please try again";
  } else if (message.includes("401") || message.includes("403")) {
    message = "Authentication failed";
    description = "Please sign in again";
  } else if (message.includes("404")) {
    message = "Not found";
    description = "The requested resource was not found";
  } else if (message.includes("429")) {
    message = "Too many requests";
    description = "Please wait a moment and try again";
  } else if (message.includes("500")) {
    message = "Server error";
    description = "Something went wrong on our end. Please try again";
  }

  toast.error(message, { description });
}

/**
 * Handle form submission with loading state
 */
export async function withLoadingToast<T>(
  promise: Promise<T>,
  loadingMessage: string,
  successMessage: string
): Promise<T> {
  const toastId = toast.loading(loadingMessage);

  try {
    const result = await promise;
    toast.success(successMessage, { id: toastId });
    return result;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}
