import { useState } from "react";
import { Upload, Image as ImageIcon, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useAddProductImages,
  useUpdateProductImages,
  useDeleteProductImage,
} from "@/hooks/useCatalogProducts";
import { ACCEPTED_IMAGE_MIME_TYPES, type AdminProductDto } from "@dragon-telecom/contract";

interface ProductImagesSectionProps {
  product: AdminProductDto;
}

// Set-03 Sprint 5 rewire — dumb-ish (owns only local drag state), always interactive
// regardless of the page's edit mode (an upload/reorder commits via its own mutation
// immediately, it doesn't need a Save round-trip). Reorder = drag to front = new primary
// (CATALOG_ROUTES.IMAGES PATCH sets isPrimary/position together, mirrors the backend's
// createProduct convention of "first file = primary").
//
// S3 added DELETE CATALOG_ROUTES.IMAGE_BY_ID — the backend removes the row, unlinks the file on
// disk, and (if the removed image was primary) promotes the lowest-position survivor, so this
// card no longer needs to do any of that itself; it just fires the mutation and lets the
// invalidated query re-render.
export function ProductImagesSection({ product }: ProductImagesSectionProps) {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const addImages = useAddProductImages();
  const updateImages = useUpdateProductImages();
  const deleteImage = useDeleteProductImage();

  const handleRemove = (imageId: string) => {
    if (!window.confirm(t("admin.productInfo.images.confirmRemove"))) return;
    deleteImage.mutate(
      { id: product.id, imageId },
      {
        onSuccess: () => toast.success(t("admin.productInfo.imageRemoveSuccess")),
        onError: () => toast.error(t("admin.productInfo.imageRemoveError")),
      },
    );
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 3 - product.images.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;
    addImages.mutate({
      id: product.id,
      command: {
        images: selected.map((_, index) => ({
          isPrimary: product.images.length === 0 && index === 0,
        })),
      },
      images: selected,
    });
  };

  const reorder = (fromIndex: number, toIndex: number) => {
    const next = [...product.images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateImages.mutate({
      id: product.id,
      command: {
        images: next.map((image, index) => ({
          id: image.id,
          position: index,
          isPrimary: index === 0,
        })),
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.productInfo.card.images")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {product.images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex != null && dragIndex !== index) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              className="relative"
            >
              <img
                src={image.thumbnailUrl ?? image.url}
                alt={image.alt ?? ""}
                className="h-24 w-full rounded-lg border object-cover"
              />
              {image.isPrimary && (
                <Badge className="absolute left-1 top-1" variant="default">
                  {t("admin.productsList.table.published")}
                </Badge>
              )}
              <GripVertical className="absolute right-1 top-1 h-4 w-4 cursor-move text-white drop-shadow" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute bottom-1 right-1 h-6 w-6"
                aria-label={t("admin.productInfo.removeImage")}
                disabled={deleteImage.isPending}
                onClick={() => handleRemove(image.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {product.images.length < 3 && (
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50">
              {addImages.isPending ? (
                <Upload className="h-6 w-6 animate-pulse text-muted-foreground" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
                multiple
                className="hidden"
                disabled={addImages.isPending}
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
            </label>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
