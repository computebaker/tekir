/**
 * Client-side image utilities
 * This file contains only browser-compatible functions
 */

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export interface ImageValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates the uploaded image file (client-side only)
 */
export function validateImageFile(file: File): ImageValidation {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image size must be less than 5MB' };
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG and PNG images are allowed' };
  }

  return { valid: true };
}

/**
 * Converts a File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Checks if a string is a valid data URL
 */
export function isValidDataUrl(url: string): boolean {
  try {
    const regex = /^data:image\/(jpeg|jpg|png);base64,/;
    return regex.test(url);
  } catch {
    return false;
  }
}

/**
 * Gets the file size of a base64 encoded image
 */
export function getBase64Size(base64: string): number {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    // Each base64 character represents 6 bits, so 4 characters = 3 bytes
    // But we need to account for padding
    const padding = (cleanBase64.match(/=/g) || []).length;
    return Math.floor((cleanBase64.length * 3) / 4) - padding;
  } catch {
    return 0;
  }
}
