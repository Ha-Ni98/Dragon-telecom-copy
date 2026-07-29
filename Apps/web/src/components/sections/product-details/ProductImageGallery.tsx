/**
 * ProductImageGallery Component
 * Displays multiple product images with preview and zoom functionality
 */

import { useState, useCallback, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { ProductImageDto } from "@dragon-telecom/contract";

interface ProductImageGalleryProps {
  images: ProductImageDto[];
  productName: string;
  className?: string;
}

export const ProductImageGallery = memo(function ProductImageGallery({ 
  images, 
  productName, 
  className 
}: ProductImageGalleryProps) {
  const { t } = useTranslation();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Find primary image or use first image
  const primaryImageIndex = images.findIndex(img => img.isPrimary) || 0;
  const currentImage = images[selectedImageIndex] || images[0];
  // ProductImageDto.alt is optional (unlike the old draft ProductImage) — fall back to the
  // product name so alt text/aria-labels are never empty.
  const currentImageAlt = currentImage?.alt ?? productName;

  // Handle image loading
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleImageError = useCallback((imageId: string) => {
    setImageErrors(prev => new Set(prev).add(imageId));
    setIsLoading(false);
  }, []);

  // Navigation functions
  const goToPrevious = useCallback(() => {
    setSelectedImageIndex(prev => 
      prev === 0 ? images.length - 1 : prev - 1
    );
  }, [images.length]);

  const goToNext = useCallback(() => {
    setSelectedImageIndex(prev => 
      prev === images.length - 1 ? 0 : prev + 1
    );
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      } else if (event.key === 'Escape') {
        setIsZoomed(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext]);

  // Set primary image on mount
  useEffect(() => {
    if (primaryImageIndex >= 0) {
      setSelectedImageIndex(primaryImageIndex);
    }
  }, [primaryImageIndex]);

  // Don't render if no images
  if (!images || images.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", className)}>
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted-foreground/20 rounded-full flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t("gallery.noImages")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Image Display */}
      <div className="relative group">
        <div className="aspect-square rounded-lg overflow-hidden bg-muted relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          
          {currentImage && !imageErrors.has(currentImage.id) ? (
            <img
              src={currentImage.url}
              alt={currentImageAlt}
              className={cn(
                "w-full h-full object-cover transition-all duration-300",
                isZoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in",
                isLoading ? "opacity-0" : "opacity-100"
              )}
              loading="lazy"
              onLoad={handleImageLoad}
              onError={() => handleImageError(currentImage.id)}
              onClick={() => setIsZoomed(!isZoomed)}
              role="button"
              tabIndex={0}
              aria-label={`${currentImageAlt}. ${t(isZoomed ? 'gallery.zoomOut' : 'gallery.zoomIn')}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsZoomed(!isZoomed);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <div className="text-center">
                <ZoomIn className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{t("gallery.imageNotAvailable")}</p>
              </div>
            </div>
          )}

          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute top-4 right-4">
              <Badge variant="secondary" className="bg-black/50 text-white">
                {selectedImageIndex + 1} / {images.length}
              </Badge>
            </div>
          )}

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={goToPrevious}
                aria-label={t("gallery.previousImage")}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={goToNext}
                aria-label={t("gallery.nextImage")}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 text-white hover:bg-black/70"
              onClick={() => setIsZoomed(!isZoomed)}
              aria-label={isZoomed ? t("gallery.zoomOut") : t("gallery.zoomIn")}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Zoom Overlay */}
        {isZoomed && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setIsZoomed(false)}
            role="button"
            tabIndex={0}
            aria-label={t("gallery.closeZoom")}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsZoomed(false);
              }
            }}
          >
            <div className="relative max-w-4xl max-h-full">
              <img
                src={currentImage?.url}
                alt={currentImageAlt}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70"
                onClick={() => setIsZoomed(false)}
                aria-label={t("gallery.closeZoom")}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Navigation */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedImageIndex(index)}
              className={cn(
                "flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200",
                selectedImageIndex === index
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
              aria-label={t("gallery.viewImage", { alt: image.alt ?? productName })}
              aria-current={selectedImageIndex === index ? "true" : "false"}
            >
              {!imageErrors.has(image.id) ? (
                <img
                  src={image.url}
                  alt={image.alt ?? productName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <ZoomIn className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Image Information */}
      {currentImage && (
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">{currentImageAlt}</p>
          {currentImage.isPrimary && (
            <Badge variant="outline" className="mt-1">
              {t("gallery.primaryImage")}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
});
