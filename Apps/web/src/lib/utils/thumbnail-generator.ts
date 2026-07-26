/**
 * Thumbnail generation and image optimization utilities
 */

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number; // 0-1
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
  backgroundColor?: string;
}

export interface ThumbnailResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

/**
 * Generate thumbnail from image file
 */
export async function generateThumbnail(
  file: File,
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  const {
    width,
    height,
    quality = 0.8,
    format = 'jpeg',
    maintainAspectRatio = true,
    backgroundColor = '#ffffff'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        let targetWidth = width;
        let targetHeight = height;

        if (maintainAspectRatio) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          const targetAspectRatio = width / height;

          if (aspectRatio > targetAspectRatio) {
            // Image is wider than target aspect ratio
            targetHeight = width / aspectRatio;
          } else {
            // Image is taller than target aspect ratio
            targetWidth = height * aspectRatio;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Set background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to generate thumbnail'));
              return;
            }

            const url = URL.createObjectURL(blob);
            resolve({
              blob,
              url,
              width: targetWidth,
              height: targetHeight,
              size: blob.size,
              format: blob.type
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate multiple thumbnail sizes
 */
export async function generateMultipleThumbnails(
  file: File,
  sizes: Array<{ name: string; options: ThumbnailOptions }>
): Promise<Record<string, ThumbnailResult>> {
  const results: Record<string, ThumbnailResult> = {};

  for (const { name, options } of sizes) {
    try {
      results[name] = await generateThumbnail(file, options);
    } catch (error) {
      console.error(`Failed to generate thumbnail ${name}:`, error);
    }
  }

  return results;
}

/**
 * Optimize image for web
 */
export async function optimizeImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}
): Promise<ThumbnailResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        let { naturalWidth, naturalHeight } = img;
        let targetWidth = naturalWidth;
        let targetHeight = naturalHeight;

        // Calculate new dimensions if image is too large
        if (naturalWidth > maxWidth || naturalHeight > maxHeight) {
          const aspectRatio = naturalWidth / naturalHeight;
          
          if (naturalWidth > naturalHeight) {
            targetWidth = Math.min(maxWidth, naturalWidth);
            targetHeight = targetWidth / aspectRatio;
          } else {
            targetHeight = Math.min(maxHeight, naturalHeight);
            targetWidth = targetHeight * aspectRatio;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to optimize image'));
              return;
            }

            const url = URL.createObjectURL(blob);
            resolve({
              blob,
              url,
              width: targetWidth,
              height: targetHeight,
              size: blob.size,
              format: blob.type
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail with smart cropping
 */
export async function generateSmartThumbnail(
  file: File,
  options: ThumbnailOptions & {
    cropMode?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  }
): Promise<ThumbnailResult> {
  const {
    width,
    height,
    quality = 0.8,
    format = 'jpeg',
    cropMode = 'center',
    backgroundColor = '#ffffff'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        const { naturalWidth, naturalHeight } = img;
        const aspectRatio = naturalWidth / naturalHeight;
        const targetAspectRatio = width / height;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = naturalWidth;
        let sourceHeight = naturalHeight;

        if (aspectRatio > targetAspectRatio) {
          // Image is wider than target aspect ratio
          sourceWidth = naturalHeight * targetAspectRatio;
          sourceX = (naturalWidth - sourceWidth) / 2;
          
          // Adjust crop position based on mode
          switch (cropMode) {
            case 'left':
              sourceX = 0;
              break;
            case 'right':
              sourceX = naturalWidth - sourceWidth;
              break;
            case 'center':
            default:
              sourceX = (naturalWidth - sourceWidth) / 2;
              break;
          }
        } else if (aspectRatio < targetAspectRatio) {
          // Image is taller than target aspect ratio
          sourceHeight = naturalWidth / targetAspectRatio;
          sourceY = (naturalHeight - sourceHeight) / 2;
          
          // Adjust crop position based on mode
          switch (cropMode) {
            case 'top':
              sourceY = 0;
              break;
            case 'bottom':
              sourceY = naturalHeight - sourceHeight;
              break;
            case 'center':
            default:
              sourceY = (naturalHeight - sourceHeight) / 2;
              break;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Set background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw cropped image
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, width, height
        );

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to generate smart thumbnail'));
              return;
            }

            const url = URL.createObjectURL(blob);
            resolve({
              blob,
              url,
              width,
              height,
              size: blob.size,
              format: blob.type
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail with watermark
 */
export async function generateThumbnailWithWatermark(
  file: File,
  options: ThumbnailOptions & {
    watermarkText?: string;
    watermarkOpacity?: number;
    watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  }
): Promise<ThumbnailResult> {
  const {
    width,
    height,
    quality = 0.8,
    format = 'jpeg',
    maintainAspectRatio = true,
    backgroundColor = '#ffffff',
    watermarkText = '',
    watermarkOpacity = 0.5,
    watermarkPosition = 'bottom-right'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        let targetWidth = width;
        let targetHeight = height;

        if (maintainAspectRatio) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          const targetAspectRatio = width / height;

          if (aspectRatio > targetAspectRatio) {
            targetHeight = width / aspectRatio;
          } else {
            targetWidth = height * aspectRatio;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Set background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Add watermark if provided
        if (watermarkText) {
          ctx.save();
          ctx.globalAlpha = watermarkOpacity;
          ctx.fillStyle = '#ffffff';
          ctx.font = `${Math.min(targetWidth, targetHeight) * 0.05}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          let x = targetWidth / 2;
          let y = targetHeight / 2;

          switch (watermarkPosition) {
            case 'top-left':
              x = targetWidth * 0.1;
              y = targetHeight * 0.1;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              break;
            case 'top-right':
              x = targetWidth * 0.9;
              y = targetHeight * 0.1;
              ctx.textAlign = 'right';
              ctx.textBaseline = 'top';
              break;
            case 'bottom-left':
              x = targetWidth * 0.1;
              y = targetHeight * 0.9;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              break;
            case 'bottom-right':
              x = targetWidth * 0.9;
              y = targetHeight * 0.9;
              ctx.textAlign = 'right';
              ctx.textBaseline = 'bottom';
              break;
            case 'center':
            default:
              break;
          }

          ctx.fillText(watermarkText, x, y);
          ctx.restore();
        }

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to generate thumbnail with watermark'));
              return;
            }

            const url = URL.createObjectURL(blob);
            resolve({
              blob,
              url,
              width: targetWidth,
              height: targetHeight,
              size: blob.size,
              format: blob.type
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail with border
 */
export async function generateThumbnailWithBorder(
  file: File,
  options: ThumbnailOptions & {
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
  }
): Promise<ThumbnailResult> {
  const {
    width,
    height,
    quality = 0.8,
    format = 'jpeg',
    maintainAspectRatio = true,
    backgroundColor = '#ffffff',
    borderWidth = 2,
    borderColor = '#000000',
    borderStyle = 'solid'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        let targetWidth = width;
        let targetHeight = height;

        if (maintainAspectRatio) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          const targetAspectRatio = width / height;

          if (aspectRatio > targetAspectRatio) {
            targetHeight = width / aspectRatio;
          } else {
            targetWidth = height * aspectRatio;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Set background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Add border
        if (borderWidth > 0) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = borderWidth;
          ctx.setLineDash(borderStyle === 'dashed' ? [5, 5] : borderStyle === 'dotted' ? [2, 2] : []);
          ctx.strokeRect(0, 0, targetWidth, targetHeight);
        }

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to generate thumbnail with border'));
              return;
            }

            const url = URL.createObjectURL(blob);
            resolve({
              blob,
              url,
              width: targetWidth,
              height: targetHeight,
              size: blob.size,
              format: blob.type
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}
