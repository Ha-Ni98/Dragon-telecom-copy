import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  X, 
  Maximize2,
  Minimize2,
  RotateCcw,
  Move
} from 'lucide-react';

interface ImagePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{
    id: string;
    preview: string;
    file: File;
    url?: string;
  }>;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

/**
 * Enhanced image preview modal with zoom, rotation, and navigation
 */
export function ImagePreview({
  isOpen,
  onClose,
  images,
  currentIndex,
  onIndexChange
}: ImagePreviewProps) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  // Reset zoom and rotation when image changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle rotation
  const handleRotateClockwise = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleRotateCounterClockwise = useCallback(() => {
    setRotation(prev => (prev - 90 + 360) % 360);
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
  }, []);

  // Handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        onIndexChange(Math.max(0, currentIndex - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        onIndexChange(Math.min(images.length - 1, currentIndex + 1));
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case '+':
      case '=':
        e.preventDefault();
        handleZoomIn();
        break;
      case '-':
        e.preventDefault();
        handleZoomOut();
        break;
      case '0':
        e.preventDefault();
        handleZoomReset();
        break;
      case 'r':
        e.preventDefault();
        handleRotateClockwise();
        break;
    }
  }, [currentIndex, images.length, onIndexChange, onClose, handleZoomIn, handleZoomOut, handleZoomReset, handleRotateClockwise]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (currentImage) {
      const link = document.createElement('a');
      link.href = currentImage.url || currentImage.preview;
      link.download = currentImage.file.name;
      link.click();
    }
  }, [currentImage]);

  // Handle fullscreen toggle
  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!currentImage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-7xl h-[90vh] p-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span>{t('admin.productAdd.imagePreview')}</span>
              <Badge variant="outline">
                {currentIndex + 1} / {images.length}
              </Badge>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              {/* Navigation */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onIndexChange(Math.min(images.length - 1, currentIndex + 1))}
                disabled={currentIndex === images.length - 1}
              >
                →
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.1}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 5}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomReset}
              >
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Rotation Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotateCounterClockwise}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotateClockwise}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Action Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleFullscreenToggle}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image Container */}
          <div 
            ref={containerRef}
            className="flex-1 flex items-center justify-center overflow-hidden bg-gray-50 relative"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              ref={imageRef}
              src={currentImage.preview}
              alt={`${t('admin.productAdd.imagePreview')} ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              draggable={false}
            />

            {/* Zoom Indicator */}
            {zoom !== 1 && (
              <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {Math.round(zoom * 100)}%
              </div>
            )}

            {/* Rotation Indicator */}
            {rotation !== 0 && (
              <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {rotation}°
              </div>
            )}
          </div>

          {/* Thumbnail Navigation */}
          {images.length > 1 && (
            <div className="p-4 border-t">
              <div className="flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => onIndexChange(index)}
                    className={`
                      relative flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden
                      ${index === currentIndex 
                        ? 'border-primary' 
                        : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                      }
                    `}
                  >
                    <img
                      src={image.preview}
                      alt={`${t('admin.productAdd.imagePreview')} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {index === currentIndex && (
                      <div className="absolute inset-0 bg-primary/20" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
