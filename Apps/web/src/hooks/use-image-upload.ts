import { useState, useCallback, useMemo } from "react";
import { ImageUploadResult } from "@/types/draft-types/admin-product-add.types";

/**
 * Image upload state interface
 */
interface ImageUploadState {
  isUploading: boolean;
  uploadProgress: Record<string, number>;
  errors: Record<string, string>;
  uploadedImages: string[];
}

/**
 * Image upload options interface
 */
interface ImageUploadOptions {
  maxImages?: number;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  compressImages?: boolean;
  quality?: number; // 0.1 to 1.0
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Custom hook for managing image uploads
 */
export function useImageUpload(options: ImageUploadOptions = {}) {
  const {
    maxImages = 3,
    maxSize = 5,
    allowedTypes = ["image/jpeg", "image/png", "image/webp"],
    compressImages = true,
    quality = 0.8,
    maxWidth = 1920,
    maxHeight = 1080
  } = options;

  const [state, setState] = useState<ImageUploadState>({
    isUploading: false,
    uploadProgress: {},
    errors: {},
    uploadedImages: []
  });

  /**
   * Validate file
   */
  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(", ")}`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `File size ${fileSizeMB.toFixed(2)}MB exceeds maximum allowed size of ${maxSize}MB`;
    }

    return null;
  }, [allowedTypes, maxSize]);

  /**
   * Compress image
   */
  const compressImage = useCallback(async (file: File): Promise<File> => {
    if (!compressImages) return file;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = img;
          const aspectRatio = width / height;

          if (width > maxWidth || height > maxHeight) {
            if (aspectRatio > 1) {
              // Landscape
              width = Math.min(width, maxWidth);
              height = width / aspectRatio;
            } else {
              // Portrait
              height = Math.min(height, maxHeight);
              width = height * aspectRatio;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          }, file.type, quality);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }, [compressImages, quality, maxWidth, maxHeight]);

  /**
   * Upload single image
   */
  const uploadImage = useCallback(async (file: File): Promise<ImageUploadResult> => {
    const fileId = `${file.name}-${Date.now()}`;
    
    try {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Update progress
      setState(prev => ({
        ...prev,
        isUploading: true,
        uploadProgress: { ...prev.uploadProgress, [fileId]: 0 }
      }));

      // Compress image if needed
      let processedFile = file;
      if (compressImages) {
        processedFile = await compressImage(file);
      }

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setState(prev => ({
          ...prev,
          uploadProgress: { ...prev.uploadProgress, [fileId]: progress }
        }));
      }

      // TODO: In a real application, this would upload to a server
      // const formData = new FormData();
      // formData.append('image', processedFile);
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData
      // });
      // const result = await response.json();

      // Mock successful upload
      const mockImageUrl = URL.createObjectURL(processedFile);
      
      setState(prev => ({
        ...prev,
        uploadedImages: [...prev.uploadedImages, mockImageUrl],
        uploadProgress: { ...prev.uploadProgress, [fileId]: 100 }
      }));

      return {
        success: true,
        imageUrl: mockImageUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, [fileId]: errorMessage }
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [validateFile, compressImage, compressImages]);

  /**
   * Upload multiple images
   */
  const uploadImages = useCallback(async (files: File[]): Promise<ImageUploadResult[]> => {
    if (files.length > maxImages) {
      return [{
        success: false,
        error: `Cannot upload more than ${maxImages} images`
      }];
    }

    setState(prev => ({
      ...prev,
      isUploading: true,
      errors: {}
    }));

    const results: ImageUploadResult[] = [];
    
    for (const file of files) {
      const result = await uploadImage(file);
      results.push(result);
    }

    setState(prev => ({
      ...prev,
      isUploading: false
    }));

    return results;
  }, [maxImages, uploadImage]);

  /**
   * Remove uploaded image
   */
  const removeImage = useCallback((imageUrl: string) => {
    setState(prev => ({
      ...prev,
      uploadedImages: prev.uploadedImages.filter(url => url !== imageUrl)
    }));
  }, []);

  /**
   * Clear all images
   */
  const clearImages = useCallback(() => {
    setState(prev => ({
      ...prev,
      uploadedImages: [],
      errors: {},
      uploadProgress: {}
    }));
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isUploading: false,
      uploadProgress: {},
      errors: {},
      uploadedImages: []
    });
  }, []);

  /**
   * Get upload statistics
   */
  const getStats = useCallback(() => {
    return {
      totalImages: state.uploadedImages.length,
      isUploading: state.isUploading,
      hasErrors: Object.keys(state.errors).length > 0,
      errorCount: Object.keys(state.errors).length,
      progress: Object.values(state.uploadProgress).reduce((sum, progress) => sum + progress, 0) / Math.max(Object.keys(state.uploadProgress).length, 1)
    };
  }, [state]);

  // Memoized values
  const stats = useMemo(() => getStats(), [getStats]);

  return {
    // State
    ...state,
    stats,
    
    // Actions
    uploadImage,
    uploadImages,
    removeImage,
    clearImages,
    reset,
    
    // Utilities
    validateFile,
    compressImage,
    getStats
  };
}
