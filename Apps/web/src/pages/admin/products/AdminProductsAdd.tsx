import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Wand2, X, GripVertical, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { MarginDisplay } from "@/components/shared/MarginDisplay";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import {
  useCatalogFamilies,
  useCatalogBrands,
  useCatalogModels,
  useCreateCatalogFamily,
  useCreateCatalogBrand,
  useCreateCatalogModel,
} from "@/hooks/useCatalogTaxonomy";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useCreateProduct, useGenerateBarcode } from "@/hooks/useCatalogProducts";
import { ACCEPTED_IMAGE_MIME_TYPES, CATALOG_ERROR } from "@dragon-telecom/contract";
import { apiErrorMessage } from "@/lib/query-client";
import {
  productsAddSchema,
  type ProductsAddFormValues,
} from "@/pages/admin/products/products-add.schema";
import { FieldError } from "@/components/shared/FieldError";
import { SectionTitle } from "@/components/shared/SectionTitle";

interface StagedImage {
  id: string;
  file: File;
  preview: string;
}

// `register(field, { valueAsNumber: true })` coerces an *empty* input via `Number("")`-style
// parsing, which yields `NaN` — not `undefined`. For a required field that's merely confusing;
// for an `.optional()` one (initialUnitCost/guestPrice/defaultSalePrice/reorderThreshold here)
// it's a real bug: `z.number().optional()` rejects `NaN` outright with a generic "expected
// number, received NaN" message, so the schema's own translated `.refine()` messages
// (initialUnitCostRequired, pricingRequiresStock) never get a chance to render — found while
// writing this sprint's tests. `setValueAs` fixes it by mapping blank to `undefined` first.
const optionalNumber = (raw: string) => (raw === "" ? undefined : Number(raw));

// ADM-03 — set-03 Sprint 5 rewire. The Sub-01 version had no real submit at all (a fake
// setTimeout + toasts, no API call). Full rewrite: RHF + zodResolver against
// products-add.schema.ts (which already carries every contract refine — family/brand XOR,
// initialUnitCost required iff qty>0, pricing forbidden iff qty=0). Inline taxonomy "create
// new" commits immediately via a real mutation and selects the new entity (ADM-03
// §Interactions) — newFamilyName/newBrandName/newModelName are never actually sent by this UI,
// since the id always resolves before submit; they exist on the command for API completeness.
// Auto-name recompute is plain string concatenation (no fake "API delay" stub — the deleted
// use-product-name-generation.ts simulated a network call for what's just string interpolation).
// On a successful create, the form is fully reset (S3 F4) — a same-path navigate() does not
// remount this route element, so without an explicit reset every field, staged image and the
// manual-name flag would survive into the "next" product.
// S19: the barcode field's "Auto-generate" now calls the real catalog generator
// (useGenerateBarcode) instead of the old BC+timestamp string it produced locally; the field
// itself stays freely editable and optional, and a duplicate is reported on the field.
export default function AdminProductsAdd() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const { data: families } = useCatalogFamilies({}, true);
  const { data: brands } = useCatalogBrands(true);
  const [selectedBrandId, setSelectedBrandId] = useState<string>();
  const { data: models } = useCatalogModels({ brandId: selectedBrandId }, true, {
    enabled: !!selectedBrandId,
  });
  const { data: categories } = useCatalogClientCategories();

  const createFamily = useCreateCatalogFamily();
  const createBrand = useCreateCatalogBrand();
  const createModel = useCreateCatalogModel();
  const createProduct = useCreateProduct();

  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [images, setImages] = useState<StagedImage[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ProductsAddFormValues>({
    resolver: zodResolver(productsAddSchema(t)),
    defaultValues: { name: "", initialQuantity: 0 },
  });

  const [familyId, brandId, modelId, initialQuantity, initialUnitCost] = watch([
    "familyId",
    "brandId",
    "modelId",
    "initialQuantity",
    "initialUnitCost",
  ]);
  const categoryPrices = watch("categoryPrices");

  const familyName = families?.find((f) => f.id === familyId)?.name ?? "";
  const brandName = brands?.find((b) => b.id === brandId)?.name ?? "";
  const modelName = models?.find((m) => m.id === modelId)?.name ?? "";

  const recomputeName = (nextFamily: string, nextBrand: string, nextModel: string) => {
    if (nameManuallyEdited) return;
    const parts = [nextFamily, nextBrand, nextModel].filter(Boolean);
    if (parts.length) setValue("name", parts.join(" "));
  };

  const generateBarcode = useGenerateBarcode();

  // The barcode prefix is derived from the family and brand names, so both must be chosen before a
  // request is worth making — a guard, not a validation error: the field itself stays optional and
  // freely editable, and the generated value is only ever a suggestion.
  const handleGenerateBarcode = () => {
    const currentFamilyId = getValues("familyId");
    const currentBrandId = getValues("brandId");
    if (!currentFamilyId || !currentBrandId) {
      toast.error(t("admin.productsAdd.barcodeNeedsFamilyBrand"));
      return;
    }
    clearErrors("barcode");
    generateBarcode.mutate(
      { familyId: currentFamilyId, brandId: currentBrandId },
      {
        // Overwrites whatever is in the field — the admin asked for a new one by clicking. Failures
        // (including the bounded-retry 409) surface through query-client.ts's generic toast, which
        // now renders the translated sentinel rather than the raw token.
        onSuccess: ({ barcode }) => setValue("barcode", barcode, { shouldDirty: true }),
      },
    );
  };

  const pricingUnlocked = (initialQuantity ?? 0) > 0;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const remaining = 3 - images.length;
    const next = Array.from(files)
      .slice(0, remaining)
      .map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...next]);
  };

  const removeImage = (id: string) => setImages((prev) => prev.filter((img) => img.id !== id));

  const reorderImages = (fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const categoryPriceValue = (categoryId: string) =>
    categoryPrices?.find((c) => c.categoryId === categoryId)?.price;

  const setCategoryPrice = (categoryId: string, price: number) => {
    const current = getValues("categoryPrices") ?? [];
    const filtered = current.filter((c) => c.categoryId !== categoryId);
    setValue("categoryPrices", price > 0 ? [...filtered, { categoryId, price }] : filtered);
  };

  const onSubmit = () => setShowConfirm(true);

  const confirmSubmit = () => {
    clearErrors("barcode");
    const values = getValues();
    createProduct.mutate(
      { command: values, images: images.map((img) => img.file) },
      {
        onSuccess: () => {
          setShowConfirm(false);
          toast.success(t("admin.productsAdd.createSuccess"));
          // A same-path navigate() does not remount this route element, so the old code left every
          // field, every staged image and the manual-name flag in place. Reset the form state
          // explicitly instead — and revoke the object URLs, or the staged previews leak.
          images.forEach((img) => URL.revokeObjectURL(img.preview));
          setImages([]);
          setNameManuallyEdited(false);
          setSelectedBrandId(undefined);
          reset({ name: "", initialQuantity: 0 });
        },
        onError: (err) => {
          setShowConfirm(false);
          // A duplicate barcode is a field problem, not a page-level one — the confirm dialog
          // closes so the admin is looking at the form when the message appears under the input.
          // Every other failure keeps the generic mutationCache toast as its only surface.
          if (apiErrorMessage(err) === CATALOG_ERROR.BARCODE_TAKEN) {
            setError("barcode", { type: "server", message: t("admin.productsAdd.barcodeTaken") });
          }
        },
      },
    );
  };

  const values = getValues();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <SectionTitle as="h1" className="text-2xl font-bold">
          {t("admin.productsAdd.pageTitle")}
        </SectionTitle>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.productsAdd.card.basicInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>{t("admin.productsAdd.familyLabel")}</Label>
                <AutocompleteInput
                  value={familyId ?? ""}
                  onChange={(value) => {
                    const family = families?.find((f) => f.id === value);
                    if (family) {
                      setValue("familyId", family.id);
                      recomputeName(family.name, brandName, modelName);
                    }
                  }}
                  suggestions={(families ?? []).map((f) => ({ value: f.id, label: f.name }))}
                  onCreateNew={(name) =>
                    createFamily.mutate(
                      { name },
                      {
                        onSuccess: (family) => {
                          setValue("familyId", family.id);
                          recomputeName(family.name, brandName, modelName);
                        },
                      },
                    )
                  }
                  emptyMessage={t("admin.productsAdd.familyLabel")}
                />
                {errors.familyId && <FieldError>{errors.familyId.message}</FieldError>}
              </div>

              <div className="space-y-1">
                <Label>{t("admin.productsAdd.brandLabel")}</Label>
                <AutocompleteInput
                  value={brandId ?? ""}
                  onChange={(value) => {
                    const brand = brands?.find((b) => b.id === value);
                    if (brand) {
                      setValue("brandId", brand.id);
                      setSelectedBrandId(brand.id);
                      recomputeName(familyName, brand.name, modelName);
                    }
                  }}
                  suggestions={(brands ?? []).map((b) => ({ value: b.id, label: b.name }))}
                  onCreateNew={(name) =>
                    createBrand.mutate(
                      { name },
                      {
                        onSuccess: (brand) => {
                          setValue("brandId", brand.id);
                          setSelectedBrandId(brand.id);
                          recomputeName(familyName, brand.name, modelName);
                        },
                      },
                    )
                  }
                  emptyMessage={t("admin.productsAdd.brandLabel")}
                />
                {errors.brandId && <FieldError>{errors.brandId.message}</FieldError>}
              </div>

              <div className="space-y-1">
                <Label>{t("admin.productsAdd.modelLabel")}</Label>
                <AutocompleteInput
                  value={modelId ?? ""}
                  onChange={(value) => {
                    const model = models?.find((m) => m.id === value);
                    if (model) {
                      setValue("modelId", model.id);
                      recomputeName(familyName, brandName, model.name);
                    }
                  }}
                  suggestions={(models ?? []).map((m) => ({ value: m.id, label: m.name }))}
                  disabled={!brandId}
                  onCreateNew={(name) => {
                    if (!brandId) return;
                    createModel.mutate(
                      { brandId, name },
                      {
                        onSuccess: (model) => {
                          setValue("modelId", model.id);
                          recomputeName(familyName, brandName, model.name);
                        },
                      },
                    );
                  }}
                  emptyMessage={t("admin.productsAdd.modelLabel")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-name">{t("admin.productsAdd.nameLabel")}</Label>
              <Input
                id="add-name"
                {...register("name", { onChange: () => setNameManuallyEdited(true) })}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-description">{t("admin.productsAdd.descriptionLabel")}</Label>
              <Textarea id="add-description" rows={3} {...register("description")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-barcode">{t("admin.productsAdd.barcodeLabel")}</Label>
              <div className="flex gap-2">
                <Input id="add-barcode" {...register("barcode")} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateBarcode}
                  disabled={generateBarcode.isPending}
                >
                  <Wand2 className="mr-1 h-4 w-4" />
                  {t("admin.productsAdd.autoGenerateBarcode")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.productsAdd.barcodeHelper")}
              </p>
              {errors.barcode && <FieldError>{errors.barcode.message}</FieldError>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.productsAdd.card.initialStock")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="add-quantity">{t("admin.productsAdd.initialQuantityLabel")}</Label>
              <Input
                id="add-quantity"
                type="number"
                min={0}
                {...register("initialQuantity", { valueAsNumber: true })}
              />
              {errors.initialQuantity && <FieldError>{errors.initialQuantity.message}</FieldError>}
            </div>

            {pricingUnlocked && (
              <div className="space-y-1">
                <Label htmlFor="add-unit-cost">{t("admin.productsAdd.initialUnitCostLabel")}</Label>
                <Input
                  id="add-unit-cost"
                  type="number"
                  step="0.01"
                  {...register("initialUnitCost", { setValueAs: optionalNumber })}
                />
                {errors.initialUnitCost && (
                  <FieldError>{errors.initialUnitCost.message}</FieldError>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.productsAdd.card.pricing")}</CardTitle>
            {!pricingUnlocked && (
              <CardDescription>{t("admin.productsAdd.card.pricingLocked")}</CardDescription>
            )}
          </CardHeader>
          {pricingUnlocked && (
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="add-guest-price">{t("admin.productsAdd.guestPriceLabel")}</Label>
                <Input
                  id="add-guest-price"
                  type="number"
                  step="0.01"
                  {...register("guestPrice", { setValueAs: optionalNumber })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.productsAdd.guestPriceHelper")}
                </p>
                <MarginDisplay price={watch("guestPrice")} cost={initialUnitCost} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="add-default-price">
                  {t("admin.productsAdd.defaultSalePriceLabel")}
                </Label>
                <Input
                  id="add-default-price"
                  type="number"
                  step="0.01"
                  {...register("defaultSalePrice", { setValueAs: optionalNumber })}
                />
                <MarginDisplay price={watch("defaultSalePrice")} cost={initialUnitCost} />
              </div>

              {(categories ?? []).map((category) => (
                <div key={category.id} className="space-y-1">
                  <Label htmlFor={`add-category-price-${category.id}`}>
                    {category.name} {t("admin.productsAdd.categoryPriceLabel")}
                  </Label>
                  <Input
                    id={`add-category-price-${category.id}`}
                    type="number"
                    step="0.01"
                    defaultValue={categoryPriceValue(category.id)}
                    onChange={(e) => setCategoryPrice(category.id, Number(e.target.value))}
                  />
                  <MarginDisplay price={categoryPriceValue(category.id)} cost={initialUnitCost} />
                </div>
              ))}

              <div className="space-y-1">
                <Label htmlFor="add-reorder-threshold">
                  {t("admin.productsAdd.reorderThresholdLabel")}
                </Label>
                <Input
                  id="add-reorder-threshold"
                  type="number"
                  min={0}
                  {...register("reorderThreshold", { setValueAs: optionalNumber })}
                />
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.productsAdd.card.images")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex != null && dragIndex !== index) reorderImages(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="relative"
                >
                  <img
                    src={img.preview}
                    alt=""
                    className="h-24 w-full rounded-lg border object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                      {t("admin.productsList.table.published")}
                    </span>
                  )}
                  <GripVertical className="absolute right-1 top-1 h-4 w-4 cursor-move text-white drop-shadow" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute bottom-1 right-1 h-6 w-6"
                    onClick={() => removeImage(img.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {images.length < 3 && (
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={createProduct.isPending}>
          {t("common.actions.save")}
        </Button>
      </form>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.productsAdd.confirmDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>
              <strong>{values.name}</strong>
            </div>
            <div className="text-muted-foreground">
              {familyName} / {brandName} {modelName ? `/ ${modelName}` : ""}
            </div>
            <div>
              {t("admin.productsAdd.initialQuantityLabel")}: {values.initialQuantity}
            </div>
            {values.defaultSalePrice != null && (
              <div>
                {t("admin.productsAdd.defaultSalePriceLabel")}:{" "}
                {formatDZD(values.defaultSalePrice, language)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={confirmSubmit} disabled={createProduct.isPending}>
              {t("admin.productsAdd.confirmDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
