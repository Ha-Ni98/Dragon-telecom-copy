import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { ImagePreview } from './image-preview';
import { 
  GripVertical, 
  Trash2, 
  RotateCw, 
  Eye, 
  Upload,
  X,
  Check,
  AlertCircle
} from 'lucide-react';

export interface ManagedImage {
  id: string;
  file: File;
  preview: string;
  url?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  isPrimary?: boolean;
}

interface ImageManagementProps {
  images: ManagedImage[];
  onImagesChange: (images: ManagedImage[]) => void;
  onImageReplace: (imageId: string, newFile: File) => void;
  onImageDelete: (imageId: string) => void;
  onImageReorder: (fromIndex: number, toIndex: number) => void;
  onPrimaryImageChange: (imageId: string) => void;
  maxImages?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Advanced image management component with reordering, deletion, and replacement
 */
export function ImageManagement({
  images,
  onImagesChange,
  onImageReplace,
  onImageDelete,
  onImageReorder,
  onPrimaryImageChange,
  maxImages = 3,
  disabled = false,
  className = ''
}: ImageManagementProps) {
  const { t } = useTranslation();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  }, [disabled]);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    onImageReorder(draggedIndex, dropIndex);
    setDraggedIndex(null);
  }, [draggedIndex, onImageReorder]);

  // Handle image replacement
  const handleImageReplace = useCallback((imageId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onImageReplace(imageId, file);
        setReplacingImageId(null);
      }
    };
    
    input.click();
  }, [onImageReplace]);

  // Handle image deletion
  const handleImageDelete = useCallback((imageId: string) => {
    if (window.confirm(t('admin.productAdd.confirmDeleteImage'))) {
      onImageDelete(imageId);
    }
  }, [onImageDelete, t]);

  // Handle primary image change
  const handlePrimaryImageChange = useCallback((imageId: string) => {
    onPrimaryImageChange(imageId);
  }, [onPrimaryImageChange]);

  // Handle preview open
  const handlePreviewOpen = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  // Handle preview close
  const handlePreviewClose = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  // Get image status badge
  const getStatusBadge = useCallback((image: ManagedImage) => {
    switch (image.status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" />{t('admin.productAdd.status.success')}</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t('admin.productAdd.status.error')}</Badge>;
      case 'uploading':
        return <Badge variant="secondary">{t('admin.productAdd.status.uploading')}</Badge>;
      default:
        return <Badge variant="outline">{t('admin.productAdd.status.pending')}</Badge>;
    }
  }, [t]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Image Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <Card 
            key={image.id}
            className={`
              relative group transition-all duration-200
              ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
              ${image.isPrimary ? 'ring-2 ring-primary' : ''}
            `}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <CardContent className="p-0">
              {/* Image Preview */}
              <div className="relative aspect-square">
                <img
                  src={image.preview}
                  alt={`${t('admin.productAdd.imagePreview')} ${index + 1}`}
                  className="w-full h-full object-cover rounded-t-lg"
                />
                
                {/* Primary Badge */}
                {image.isPrimary && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="default" className="bg-primary">
                      {t('admin.productAdd.primaryImage')}
                    </Badge>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(image)}
                </div>

                {/* Progress Bar */}
                {image.status === 'uploading' && image.progress !== undefined && (
                  <div className="absolute bottom-0 left-0 right-0">
                    <div className="bg-black/50 text-white text-xs p-1">
                      <div className="flex justify-between items-center">
                        <span>{t('admin.productAdd.uploading')}</span>
                        <span>{image.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
                        <div 
                          className="bg-white h-1 rounded-full transition-all duration-300"
                          style={{ width: `${image.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {image.status === 'error' && image.error && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs p-2">
                    {image.error}
                  </div>
                )}

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePreviewOpen(index)}
                    disabled={disabled}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {!image.isPrimary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePrimaryImageChange(image.id)}
                      disabled={disabled}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleImageReplace(image.id)}
                    disabled={disabled}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleImageDelete(image.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Image Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {image.file.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {(image.file.size / 1024 / 1024).toFixed(2)} MB
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handlePreviewOpen(index)}
                    disabled={disabled}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {t('admin.productAdd.preview')}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleImageReplace(image.id)}
                    disabled={disabled}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleImageDelete(image.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {images.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">{t('admin.productAdd.noImages')}</h3>
                <p className="text-muted-foreground">{t('admin.productAdd.noImagesDescription')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Preview Modal */}
      {previewIndex !== null && (
        <ImagePreview
          isOpen={true}
          onClose={handlePreviewClose}
          images={images}
          currentIndex={previewIndex}
          onIndexChange={setPreviewIndex}
        />
      )}
    </div>
  );
}
