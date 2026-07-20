import { useState } from "react";
import { Upload, Image as ImageIcon, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { useAddProductImages, useUpdateProductImages } from "@/hooks/useCatalogProducts";
import type { AdminProductDto } from "@dragon-telecom/contract";

interface ProductImagesSectionProps {
  product: AdminProductDto;
}

// Set-03 Sprint 5 rewire — dumb-ish (owns only local drag state), always interactive
// regardless of the page's edit mode (an upload/reorder commits via its own mutation
// immediately, it doesn't need a Save round-trip). Reorder = drag to front = new primary
// (CATALOG_ROUTES.IMAGES PATCH sets isPrimary/position together, mirrors the backend's
// createProduct convention of "first file = primary").
//
// Known gap: there is no DELETE /admin/products/:id/images endpoint (only POST add + PATCH
// reorder/metadata) — this card can add and reorder images but cannot remove one already
// uploaded. Out of this sprint's authorized scope to add a new endpoint for.
export function ProductImagesSection({ product }: ProductImagesSectionProps) {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const addImages = useAddProductImages();
  const updateImages = useUpdateProductImages();

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
                src={image.url}
                alt={image.alt ?? ""}
                className="h-24 w-full rounded-lg border object-cover"
              />
              {image.isPrimary && (
                <Badge className="absolute left-1 top-1" variant="default">
                  {t("admin.productsList.table.published")}
                </Badge>
              )}
              <GripVertical className="absolute right-1 top-1 h-4 w-4 cursor-move text-white drop-shadow" />
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
                accept="image/*"
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
