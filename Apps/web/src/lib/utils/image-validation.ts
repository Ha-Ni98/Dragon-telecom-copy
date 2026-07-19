/**
 * Comprehensive image validation utilities
 */

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    width: number;
    height: number;
    size: number;
    type: string;
    aspectRatio: number;
  };
}

export interface ImageValidationOptions {
  maxSize?: number; // in MB
  minSize?: number; // in MB
  maxWidth?: number;
  minWidth?: number;
  maxHeight?: number;
  minHeight?: number;
  allowedTypes?: string[];
  allowedAspectRatios?: Array<{ min: number; max: number }>;
  requireSquare?: boolean;
  requireLandscape?: boolean;
  requirePortrait?: boolean;
}

/**
 * Validate image file with comprehensive checks
 */
export async function validateImageFile(
  file: File,
  options: ImageValidationOptions = {}
): Promise<ImageValidationResult> {
  const {
    maxSize = 5, // 5MB
    minSize = 0.01, // 10KB
    maxWidth = 4000,
    minWidth = 100,
    maxHeight = 4000,
    minHeight = 100,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    allowedAspectRatios,
    requireSquare = false,
    requireLandscape = false,
    requirePortrait = false
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  let metadata: ImageValidationResult['metadata'];

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSize) {
    errors.push(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum allowed size of ${maxSize}MB`);
  }
  if (fileSizeMB < minSize) {
    errors.push(`File size ${fileSizeMB.toFixed(2)}MB is below minimum required size of ${minSize}MB`);
  }

  // Get image dimensions
  try {
    const dimensions = await getImageDimensions(file);
    metadata = {
      width: dimensions.width,
      height: dimensions.height,
      size: fileSizeMB,
      type: file.type,
      aspectRatio: dimensions.width / dimensions.height
    };

    // Check dimensions
    if (dimensions.width > maxWidth) {
      errors.push(`Image width ${dimensions.width}px exceeds maximum allowed width of ${maxWidth}px`);
    }
    if (dimensions.width < minWidth) {
      errors.push(`Image width ${dimensions.width}px is below minimum required width of ${minWidth}px`);
    }
    if (dimensions.height > maxHeight) {
      errors.push(`Image height ${dimensions.height}px exceeds maximum allowed height of ${maxHeight}px`);
    }
    if (dimensions.height < minHeight) {
      errors.push(`Image height ${dimensions.height}px is below minimum required height of ${minHeight}px`);
    }

    // Check aspect ratio requirements
    if (requireSquare && Math.abs(dimensions.width - dimensions.height) > 1) {
      errors.push('Image must be square (width and height must be equal)');
    }

    if (requireLandscape && dimensions.width <= dimensions.height) {
      errors.push('Image must be landscape (width must be greater than height)');
    }

    if (requirePortrait && dimensions.width >= dimensions.height) {
      errors.push('Image must be portrait (height must be greater than width)');
    }

    // Check allowed aspect ratios
    if (allowedAspectRatios && allowedAspectRatios.length > 0) {
      const aspectRatio = dimensions.width / dimensions.height;
      const isAllowed = allowedAspectRatios.some(ratio => 
        aspectRatio >= ratio.min && aspectRatio <= ratio.max
      );
      
      if (!isAllowed) {
        errors.push(`Image aspect ratio ${aspectRatio.toFixed(2)} is not allowed`);
      }
    }

    // Add warnings for very large images
    if (dimensions.width > 2000 || dimensions.height > 2000) {
      warnings.push('Large image detected. Consider optimizing for web use.');
    }

    // Add warnings for very small images
    if (dimensions.width < 300 || dimensions.height < 300) {
      warnings.push('Small image detected. Consider using a higher resolution image.');
    }

  } catch (error) {
    errors.push('Failed to read image dimensions. The file may be corrupted.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata
  };
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Validate multiple images
 */
export async function validateImageFiles(
  files: File[],
  options: ImageValidationOptions = {}
): Promise<{
  validFiles: File[];
  invalidFiles: Array<{ file: File; result: ImageValidationResult }>;
  allErrors: string[];
  allWarnings: string[];
}> {
  const validFiles: File[] = [];
  const invalidFiles: Array<{ file: File; result: ImageValidationResult }> = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const file of files) {
    const result = await validateImageFile(file, options);
    
    if (result.isValid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ file, result });
    }
    
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    validFiles,
    invalidFiles,
    allErrors,
    allWarnings
  };
}

/**
 * Get image file info
 */
export function getImageFileInfo(file: File): Promise<{
  name: string;
  size: number;
  sizeFormatted: string;
  type: string;
  lastModified: Date;
  dimensions?: { width: number; height: number };
}> {
  return new Promise(async (resolve) => {
    const sizeFormatted = formatFileSize(file.size);
    let dimensions: { width: number; height: number } | undefined;
    
    try {
      dimensions = await getImageDimensions(file);
    } catch (error) {
      // Ignore dimension errors for file info
    }
    
    resolve({
      name: file.name,
      size: file.size,
      sizeFormatted,
      type: file.type,
      lastModified: new Date(file.lastModified),
      dimensions
    });
  });
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get image type from file extension
 */
export function getImageTypeFromExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  width: number,
  height: number,
  options: {
    maxWidth?: number;
    minWidth?: number;
    maxHeight?: number;
    minHeight?: number;
    requireSquare?: boolean;
    requireLandscape?: boolean;
    requirePortrait?: boolean;
  } = {}
): { isValid: boolean; errors: string[] } {
  const {
    maxWidth = 4000,
    minWidth = 100,
    maxHeight = 4000,
    minHeight = 100,
    requireSquare = false,
    requireLandscape = false,
    requirePortrait = false
  } = options;

  const errors: string[] = [];

  if (width > maxWidth) {
    errors.push(`Width ${width}px exceeds maximum allowed width of ${maxWidth}px`);
  }
  if (width < minWidth) {
    errors.push(`Width ${width}px is below minimum required width of ${minWidth}px`);
  }
  if (height > maxHeight) {
    errors.push(`Height ${height}px exceeds maximum allowed height of ${maxHeight}px`);
  }
  if (height < minHeight) {
    errors.push(`Height ${height}px is below minimum required height of ${minHeight}px`);
  }

  if (requireSquare && Math.abs(width - height) > 1) {
    errors.push('Image must be square (width and height must be equal)');
  }
  if (requireLandscape && width <= height) {
    errors.push('Image must be landscape (width must be greater than height)');
  }
  if (requirePortrait && width >= height) {
    errors.push('Image must be portrait (height must be greater than width)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
