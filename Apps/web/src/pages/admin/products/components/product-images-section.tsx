import React, { useState, useRef } from 'react';
import { Upload, X, Star, Eye, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/useTranslation';
import { useProductImages } from '@/hooks/use-product-images';
import { AdminProductWithFullDetails, AdminProductImage, PRODUCT_INFORMATION_CONSTANTS } from '@/types/draft-types/admin-product-information.types';

interface ProductImagesSectionProps {
  /** Product data containing images */
  product: AdminProductWithFullDetails;
  /** Whether the section is in edit mode */
  isEditMode: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Product images section component
 * Manages product image display, upload, removal, and primary image selection
 */
export function ProductImagesSection({
  product,
  isEditMode,
  isSaving,
}: ProductImagesSectionProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<AdminProductImage | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  // Image management hooks
  const {
    uploadImage,
    removeImage,
    setPrimaryImage,
    isUploading,
    isRemoving,
    isSettingPrimary,
    canUploadMore,
    uploadError,
    removeError,
    setPrimaryError,
  } = useProductImages(product.idProduct);

  /**
   * Handle file input change
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadImage(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Handle image upload button click
   */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handle image removal with confirmation
   */
  const handleRemoveImage = async (imageId: string) => {
    await removeImage(imageId);
    setShowDeleteDialog(null);
  };

  /**
   * Handle primary image selection
   */
  const handleSetPrimary = async (imageId: string) => {
    await setPrimaryImage(imageId);
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Format upload date for display
   */
  const formatUploadDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" id="images-heading">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          {t('admin.productInfo.images')}
        </CardTitle>
        <CardDescription>
          {isEditMode ? 'Manage product images below' : 'Product images and gallery'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6" role="region" aria-labelledby="images-heading">
          {/* Upload Section */}
          {isEditMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">{t('admin.products.images.uploadNew')}</h3>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: JPG, PNG, WebP. Max size: {(PRODUCT_INFORMATION_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024))}MB
                  </p>
                </div>
                <Button
                  onClick={handleUploadClick}
                  disabled={isUploading || isSaving || !canUploadMore(product.images.length)}
                  className="flex items-center gap-2"
                  aria-label={t('admin.products.images.uploadNewAria')}
                >
                  <Plus className="h-4 w-4" />
                  {t('admin.productInfo.uploadImage')}
                </Button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                aria-label={t('admin.products.images.selectFileAria')}
              />

              {/* Upload error display */}
              {uploadError && (
                <Alert variant="destructive">
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              {/* Upload limit warning */}
              {!canUploadMore(product.images.length) && (
                <Alert>
                  <AlertDescription>
                    Maximum number of images ({PRODUCT_INFORMATION_CONSTANTS.MAX_IMAGES}) reached.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Images Grid */}
          {product.images.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {product.images.map((image) => (
                <div
                  key={image.id}
                  className="relative group border rounded-lg overflow-hidden bg-muted/50"
                >
                  {/* Image */}
                  <div className="aspect-square relative">
                    <img
                      src={image.url}
                      alt={image.alt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Primary badge */}
                    {image.isPrimary && (
                      <Badge className="absolute top-2 left-2 bg-primary">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}

                    {/* Action buttons overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {/* View button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedImage(image)}
                        aria-label={`View ${image.alt}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Set primary button */}
                      {isEditMode && !image.isPrimary && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetPrimary(image.id)}
                          disabled={isSettingPrimary}
                          aria-label={`Set ${image.alt} as primary image`}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Remove button */}
                      {isEditMode && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setShowDeleteDialog(image.id)}
                          disabled={isRemoving}
                          aria-label={`Remove ${image.alt}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Image info */}
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-medium truncate">{image.alt}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatFileSize(image.fileSize)}</span>
                      <span>{formatUploadDate(image.uploadedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">{t('admin.products.images.noImagesUploaded')}</p>
              <p className="text-sm">
                {isEditMode
                  ? t('admin.products.images.uploadToShowcase')
                  : t('admin.products.images.noImagesAvailable')
                }
              </p>
            </div>
          )}

          {/* Error displays */}
          {removeError && (
            <Alert variant="destructive">
              <AlertDescription>{removeError}</AlertDescription>
            </Alert>
          )}

          {setPrimaryError && (
            <Alert variant="destructive">
              <AlertDescription>{setPrimaryError}</AlertDescription>
            </Alert>
          )}

          {/* Image Preview Dialog */}
          <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{selectedImage?.alt}</DialogTitle>
                <DialogDescription>
                  Uploaded on {selectedImage && formatUploadDate(selectedImage.uploadedAt)} • 
                  {selectedImage && formatFileSize(selectedImage.fileSize)}
                </DialogDescription>
              </DialogHeader>
              {selectedImage && (
                <div className="relative">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.alt}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                  />
                  {selectedImage.isPrimary && (
                    <Badge className="absolute top-4 left-4 bg-primary">
                      <Star className="h-3 w-3 mr-1" />
                      Primary Image
                    </Badge>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('admin.products.images.confirmRemoval')}</DialogTitle>
                <DialogDescription>
                  {t('admin.products.images.confirmRemovalBody')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(null)}
                  disabled={isRemoving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => showDeleteDialog && handleRemoveImage(showDeleteDialog)}
                  disabled={isRemoving}
                >
                  {isRemoving ? 'Removing...' : 'Remove Image'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
