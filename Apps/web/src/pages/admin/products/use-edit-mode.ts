import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateProduct, useUpdatePricing } from "@/hooks/useCatalogProducts";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import type { AdminProductDto } from "@dragon-telecom/contract";
import {
  productDetailsSchema,
  type ProductDetailsFormValues,
} from "@/pages/admin/products/product-details.schema";
import {
  productPricingSchema,
  type ProductPricingFormValues,
  type ProductPricingInput,
} from "@/pages/admin/products/product-pricing.schema";

// ADM-04's "one header Edit/Save/Cancel spanning all cards" (§Layout) — Save patches core +
// pricing as two separate requests (§Forms: "Save patches core + pricing separately"), so this
// owns two independent RHF instances and fires both handleSubmit calls together; Cancel just
// resets both forms back to the fetched product, discarding any typed-but-unsaved edits.
export function useEditMode(product: AdminProductDto | undefined) {
  const { t } = useTranslation();
  const [isEditMode, setIsEditMode] = useState(false);
  const updateProduct = useUpdateProduct();
  const updatePricing = useUpdatePricing();
  const { data: categories } = useCatalogClientCategories();

  const detailsForm = useForm<ProductDetailsFormValues>({
    resolver: zodResolver(productDetailsSchema(t)),
  });
  const pricingForm = useForm<ProductPricingInput, unknown, ProductPricingFormValues>({
    resolver: zodResolver(productPricingSchema(t)),
  });

  const resetFromProduct = () => {
    if (!product) return;
    detailsForm.reset({
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      reorderThreshold: product.reorderThreshold,
    });
    pricingForm.reset({
      guestPrice: product.guestPrice,
      defaultSalePrice: product.defaultSalePrice,
      // One row per client category, not per existing ProductPrice row (S3 R2) — a product with
      // no category prices yet must still offer an (empty) input for each, or the card offers no
      // way to ever set one. `price: undefined` renders blank and is dropped by the schema's
      // transform (product-pricing.schema.ts) unless the admin types something.
      categoryPrices: (categories ?? []).map((category) => ({
        categoryId: category.id,
        price: product.categoryPrices.find((c) => c.categoryId === category.id)?.price,
      })),
    });
  };

  // Reset whenever a fresh product arrives (initial load, or a refetch after save), and once the
  // category list resolves (S3 R2) — categories starts as [] before that query settles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetFromProduct, [product, categories]);

  const toggle = () => {
    if (!isEditMode) resetFromProduct();
    setIsEditMode((prev) => !prev);
  };

  const cancel = () => {
    resetFromProduct();
    setIsEditMode(false);
  };

  // Both handleSubmit calls resolve after validation regardless of outcome, so success is tracked
  // by a flag set inside each valid-callback. Previously setIsEditMode(false) ran unconditionally
  // and synchronously: an invalid form silently dropped out of edit mode having saved nothing and
  // shown nothing (S3 finding F2) — which is what made the guest-price bug look like a no-op.
  const save = async () => {
    if (!product) return;
    let detailsOk = false;
    let pricingOk = false;

    await Promise.all([
      detailsForm.handleSubmit((values) => {
        detailsOk = true;
        updateProduct.mutate({ id: product.id, command: values });
      })(),
      pricingForm.handleSubmit((values) => {
        pricingOk = true;
        updatePricing.mutate({ id: product.id, command: values });
      })(),
    ]);

    if (detailsOk && pricingOk) {
      toast.success(t("admin.productInfo.saveSuccess"));
      setIsEditMode(false);
    } else {
      toast.error(t("admin.productInfo.saveError"));
    }
  };

  return {
    isEditMode,
    isSaving: updateProduct.isPending || updatePricing.isPending,
    toggle,
    save,
    cancel,
    detailsForm,
    pricingForm,
  };
}
