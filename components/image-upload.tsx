"use client";

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { fileToBase64, validateImageFile } from '@/lib/image-client';

interface ImageUploadProps {
  currentImage?: string;
  onImageUpload: (imageData: string) => Promise<void>;
  onImageRemove: () => Promise<void>;
  disabled?: boolean;
  size?: number;
}

export default function ImageUpload({
  currentImage,
  onImageUpload,
  onImageRemove,
  disabled = false,
  size = 120
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to determine if we should use Next.js Image or regular img
  const shouldUseNextImage = (src: string) => {
    // Use regular img for DiceBear URLs to hit API directly
    return !src.includes('api.dicebear.com');
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled) return;

    setError(null);
    
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    try {
      // Convert to base64
      const base64 = await fileToBase64(file);
      
      // Upload the image
      await onImageUpload(base64);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  }, [disabled, onImageUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [disabled, handleFileSelect]);

  const handleRemoveImage = useCallback(async () => {
    if (disabled) return;
    
    setIsUploading(true);
    try {
      await onImageRemove();
    } catch (err) {
      console.error('Remove error:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove image');
    } finally {
      setIsUploading(false);
    }
  }, [disabled, onImageRemove]);

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div className="space-y-4">
      {/* Avatar Display and Upload Area */}
    <div className="relative inline-block">
      <div
        className={`
        relative group cursor-pointer rounded-full overflow-hidden border-4 border-dashed
        transition-all duration-200 hover:border-primary/50
        ${isDragging ? 'border-primary bg-primary/5' : 'border-muted'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ width: size, height: size }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        {currentImage ? (
          (() => {
            if (shouldUseNextImage(currentImage)) {
              return (
                <Image
                  src={currentImage}
                  alt="Profile"
                  width={size}
                  height={size}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              );
            } else {
              return (
                <img
                  src={currentImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  style={{ width: size, height: size }}
                />
              );
            }
          })()
        ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
          <Camera className="w-8 h-8 text-muted-foreground/60 mb-2" />
          <span className="text-xs text-muted-foreground text-center px-2">
            Click or drag to upload
          </span>
        </div>
        )}

        {/* Upload overlay */}
        {!disabled && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="text-white text-center">
            <Upload className="w-6 h-6 mx-auto mb-1" />
            <span className="text-xs">Upload new</span>
          </div>
        </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
        )}
      </div>

      {/* Remove button */}
      {currentImage && !disabled && (
        <button
        onClick={(e) => {
          e.stopPropagation();
          handleRemoveImage();
        }}
        disabled={isUploading}
        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors disabled:opacity-50"
        title="Remove image"
        >
        <X className="w-3 h-3" />
        </button>
      )}
    </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Upload instructions */}
      <div className="text-sm text-muted-foreground">
        <p>Upload a profile picture</p>
        <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
          <li>JPG or PNG format</li>
          <li>Maximum size: 5MB</li>
          <li>Image will be resized to {size}×{size}</li>
        </ul>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}
    </div>
  );
}
