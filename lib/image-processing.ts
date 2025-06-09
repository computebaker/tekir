import sharp from 'sharp';
import { z } from 'zod';

// Validation schema for image uploads
export const imageUploadSchema = z.object({
  data: z.string().min(1, 'Image data is required'),
  type: z.enum(['image/jpeg', 'image/jpg', 'image/png'], {
    errorMap: () => ({ message: 'Only JPEG and PNG images are allowed' })
  }),
  size: z.number().max(5 * 1024 * 1024, 'Image size must be less than 5MB')
});

// Configuration
const AVATAR_SIZE = 150;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const QUALITY = 85;

export interface ProcessedImage {
  base64: string;
  size: number;
  format: string;
}

/**
 * Validates the uploaded image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
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
 * Extracts base64 data from data URL
 */
export function extractBase64Data(dataUrl: string): { data: string; type: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }
  return {
    type: matches[1],
    data: matches[2]
  };
}

/**
 * Processes and resizes an image for avatar use
 */
export async function processAvatarImage(base64Data: string): Promise<ProcessedImage> {
  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Process the image with sharp
    const processedBuffer = await sharp(imageBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: QUALITY })
      .toBuffer();

    // Convert back to base64
    const processedBase64 = processedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${processedBase64}`;

    return {
      base64: dataUrl,
      size: processedBuffer.length,
      format: 'jpeg'
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
}

/**
 * Validates and processes an image upload
 */
export async function validateAndProcessImage(dataUrl: string): Promise<ProcessedImage> {
  try {
    // Extract data from data URL
    const { data, type } = extractBase64Data(dataUrl);
    
    // Validate the extracted data
    const originalSize = Buffer.from(data, 'base64').length;
    
    const validation = imageUploadSchema.safeParse({
      data,
      type,
      size: originalSize
    });

    if (!validation.success) {
      throw new Error(validation.error.issues[0].message);
    }

    // Process the image
    return await processAvatarImage(data);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to validate and process image');
  }
}

/**
 * Creates a data URL from base64 data and type
 */
export function createDataUrl(base64Data: string, type: string = 'image/jpeg'): string {
  // Remove data URL prefix if it exists
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  return `data:${type};base64,${cleanBase64}`;
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
    return Buffer.from(cleanBase64, 'base64').length;
  } catch {
    return 0;
  }
}
