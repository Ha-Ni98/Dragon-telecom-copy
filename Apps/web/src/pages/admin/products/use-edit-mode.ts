import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateProduct, useUpdatePricing, useGenerateBarcode } from "@/hooks/useCatalogProducts";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { CATALOG_ERROR, type AdminProductDto } from "@dragon-telecom/contract";
import { apiErrorMessage } from "@/lib/query-client";
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
  const generateBarcodeMutation = useGenerateBarcode();

  // ADM-04's barcode is editable in edit mode (S19) and a generated value is only a suggestion: it
  // lands in the form, not the database, until Save runs. Unlike ADM-03 there is no "choose a
  // family and brand first" guard — UpdateProductCommand cannot change taxonomy (catalog spec
  // Business Logic #6), so an existing product always has both.
  const generateBarcode = () => {
    if (!product) return;
    detailsForm.clearErrors("barcode");
    generateBarcodeMutation.mutate(
      { familyId: product.family.id, brandId: product.brand.id },
      {
        onSuccess: ({ barcode }) => detailsForm.setValue("barcode", barcode, { shouldDirty: true }),
      },
    );
  };

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
  // by a flag — but the flag is now set only after the request itself resolves (S19), not merely
  // after validation passes. Previously the success toast fired and edit mode closed before the
  // server answered, which left a server-side rejection (a duplicate barcode) with nowhere visible
  // to land. Falling out of edit mode having saved nothing and shown nothing was S3 finding F2.
  const save = async () => {
    if (!product) return;
    let detailsOk = false;
    let pricingOk = false;
    detailsForm.clearErrors("barcode");

    await Promise.all([
      detailsForm.handleSubmit(async (values) => {
        try {
          await updateProduct.mutateAsync({ id: product.id, command: values });
          detailsOk = true;
        } catch (err) {
          // S19 — a duplicate barcode is a field problem: keep edit mode open and put the message
          // under the barcode input. Every other failure is already reported by query-client.ts's
          // generic mutationCache toast; `detailsOk` staying false is what holds edit mode open.
          if (apiErrorMessage(err) === CATALOG_ERROR.BARCODE_TAKEN) {
            detailsForm.setError("barcode", {
              type: "server",
              message: t("admin.productsAdd.barcodeTaken"),
            });
          }
        }
      })(),
      pricingForm.handleSubmit(async (values) => {
        try {
          await updatePricing.mutateAsync({ id: product.id, command: values });
          pricingOk = true;
        } catch {
          // Surfaced by the generic mutationCache toast; the flag staying false holds edit mode.
        }
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
    generateBarcode,
    isGeneratingBarcode: generateBarcodeMutation.isPending,
    detailsForm,
    pricingForm,
  };
}
