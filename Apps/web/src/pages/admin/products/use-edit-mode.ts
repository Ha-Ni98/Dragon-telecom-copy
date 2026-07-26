import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateProduct, useUpdatePricing } from "@/hooks/useCatalogProducts";
import type { AdminProductDto } from "@dragon-telecom/contract";
import {
  productDetailsSchema,
  type ProductDetailsFormValues,
} from "@/pages/admin/products/product-details.schema";
import {
  productPricingSchema,
  type ProductPricingFormValues,
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

  const detailsForm = useForm<ProductDetailsFormValues>({
    resolver: zodResolver(productDetailsSchema(t)),
  });
  const pricingForm = useForm<ProductPricingFormValues>({
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
      categoryPrices: product.categoryPrices.map((c) => ({
        categoryId: c.categoryId,
        price: c.price,
      })),
    });
  };

  // Reset whenever a fresh product arrives (initial load, or a refetch after save).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetFromProduct, [product]);

  const toggle = () => {
    if (!isEditMode) resetFromProduct();
    setIsEditMode((prev) => !prev);
  };

  const cancel = () => {
    resetFromProduct();
    setIsEditMode(false);
  };

  const save = () => {
    if (!product) return;
    detailsForm.handleSubmit((values) => {
      updateProduct.mutate({ id: product.id, command: values });
    })();
    pricingForm.handleSubmit((values) => {
      updatePricing.mutate({ id: product.id, command: values });
    })();
    setIsEditMode(false);
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
