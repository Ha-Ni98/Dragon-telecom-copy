import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Image as ImageIcon, 
  Loader2,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Props for the DragDropArea component
 */
interface DragDropAreaProps {
  onFilesSelected: (files: File[]) => void;
  maxImages?: number;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  disabled?: boolean;
  isUploading?: boolean;
  className?: string;
}

/**
 * Drag and drop area component
 */
export function DragDropArea({
  onFilesSelected,
  maxImages = 3,
  maxSize = 5,
  allowedTypes = ["image/jpeg", "image/png", "image/webp"],
  disabled = false,
  isUploading = false,
  className
}: DragDropAreaProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  }, [disabled, isUploading]);

  /**
   * Handle drag enter
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setDragCounter(prev => prev + 1);
      setIsDragOver(true);
    }
  }, [disabled, isUploading]);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  }, [dragCounter]);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [disabled, isUploading, onFilesSelected]);

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFilesSelected]);

  /**
   * Handle open file dialog
   */
  const handleOpenFileDialog = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  /**
   * Get allowed types display string
   */
  const getAllowedTypesDisplay = () => {
    return allowedTypes.map(type => type.split('/')[1]?.toUpperCase()).join(', ');
  };

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-all duration-200",
        isDragOver 
          ? "border-primary bg-primary/5 scale-105" 
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "opacity-50 cursor-not-allowed",
        isUploading && "opacity-75 cursor-wait",
        className
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Icon */}
          <div className={cn(
            "rounded-full p-3 transition-colors",
            isDragOver ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isDragOver ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </div>
          
          {/* Content */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">
              {isUploading
                ? t('admin.products.images.processing')
                : isDragOver
                  ? t('admin.products.images.dropHere')
                  : t('admin.products.images.uploadTitle')
              }
            </h3>
            
            <p className="text-sm text-muted-foreground">
              {isUploading
                ? t('admin.products.images.processingBody')
                : isDragOver
                  ? t('admin.products.images.releaseToUpload')
                  : t('admin.products.images.dragDropBody')
              }
            </p>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('admin.products.images.maxImages', { max: maxImages, size: maxSize })}</p>
              <p>{t('admin.products.images.supported')}: {getAllowedTypesDisplay()}</p>
            </div>
          </div>

          {/* Action Button */}
          <Button
            type="button"
            onClick={handleOpenFileDialog}
            disabled={disabled || isUploading}
            className="w-full sm:w-auto"
            variant={isDragOver ? "default" : "outline"}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            {isUploading ? t('admin.products.images.processingShort') : t('admin.products.images.chooseImages')}
          </Button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTypes.join(",")}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || isUploading}
          />
        </div>

        {/* Drag Over Indicator */}
        {isDragOver && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg flex items-center justify-center">
            <div className="text-center text-primary">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm font-medium">{t('admin.products.images.dropHere')}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
