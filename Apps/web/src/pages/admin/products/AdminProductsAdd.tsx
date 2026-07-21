import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Wand2, X, GripVertical, Upload } from "lucide-react";
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
import { useCreateProduct } from "@/hooks/useCatalogProducts";
import {
  productsAddSchema,
  type ProductsAddFormValues,
} from "@/pages/admin/products/products-add.schema";

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

  const familyName = families?.find((f) => f.id === familyId)?.name ?? "";
  const brandName = brands?.find((b) => b.id === brandId)?.name ?? "";
  const modelName = models?.find((m) => m.id === modelId)?.name ?? "";

  const recomputeName = (nextFamily: string, nextBrand: string, nextModel: string) => {
    if (nameManuallyEdited) return;
    const parts = [nextFamily, nextBrand, nextModel].filter(Boolean);
    if (parts.length) setValue("name", parts.join(" "));
  };

  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    setValue("barcode", `BC${timestamp}${random}`);
  };

  const pricingUnlocked = (initialQuantity ?? 0) > 0;

  const marginPercent = (price?: number) => {
    if (!price || !initialUnitCost) return undefined;
    return ((price - initialUnitCost) / initialUnitCost) * 100;
  };

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
    getValues("categoryPrices")?.find((c) => c.categoryId === categoryId)?.price;

  const setCategoryPrice = (categoryId: string, price: number) => {
    const current = getValues("categoryPrices") ?? [];
    const filtered = current.filter((c) => c.categoryId !== categoryId);
    setValue("categoryPrices", price > 0 ? [...filtered, { categoryId, price }] : filtered);
  };

  const onSubmit = () => setShowConfirm(true);

  const confirmSubmit = () => {
    const values = getValues();
    createProduct.mutate(
      { command: values, images: images.map((img) => img.file) },
      {
        onSuccess: (product) => {
          setShowConfirm(false);
          navigate(`/admin/products/${product.id}`);
        },
        onError: () => setShowConfirm(false),
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
        <h1 className="text-2xl font-bold">{t("admin.productsAdd.pageTitle")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.productsAdd.card.basicInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="add-barcode">{t("admin.productsAdd.barcodeLabel")}</Label>
              <div className="flex gap-2">
                <Input id="add-barcode" {...register("barcode")} />
                <Button type="button" variant="outline" onClick={generateBarcode}>
                  <Wand2 className="mr-1 h-4 w-4" />
                  {t("admin.productsAdd.autoGenerateBarcode")}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-name">{t("admin.productsAdd.nameLabel")}</Label>
              <Input
                id="add-name"
                {...register("name", { onChange: () => setNameManuallyEdited(true) })}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>{t("admin.productsAdd.familyLabel")}</Label>
                <AutocompleteInput
                  value={familyName}
                  onChange={(value) => {
                    const family = families?.find((f) => f.id === value);
                    if (family) {
                      setValue("familyId", family.id);
                      recomputeName(family.name, brandName, modelName);
                    }
                  }}
                  suggestions={(families ?? []).map((f) => ({ value: f.id, label: f.name }))}
                  onSearch={() => {}}
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
                {errors.familyId && (
                  <p className="text-sm text-destructive">{errors.familyId.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>{t("admin.productsAdd.brandLabel")}</Label>
                <AutocompleteInput
                  value={brandName}
                  onChange={(value) => {
                    const brand = brands?.find((b) => b.id === value);
                    if (brand) {
                      setValue("brandId", brand.id);
                      setSelectedBrandId(brand.id);
                      recomputeName(familyName, brand.name, modelName);
                    }
                  }}
                  suggestions={(brands ?? []).map((b) => ({ value: b.id, label: b.name }))}
                  onSearch={() => {}}
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
                {errors.brandId && (
                  <p className="text-sm text-destructive">{errors.brandId.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>{t("admin.productsAdd.modelLabel")}</Label>
                <AutocompleteInput
                  value={modelName}
                  onChange={(value) => {
                    const model = models?.find((m) => m.id === value);
                    if (model) {
                      setValue("modelId", model.id);
                      recomputeName(familyName, brandName, model.name);
                    }
                  }}
                  suggestions={(models ?? []).map((m) => ({ value: m.id, label: m.name }))}
                  onSearch={() => {}}
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
              <Label htmlFor="add-description">{t("admin.productsAdd.descriptionLabel")}</Label>
              <Textarea id="add-description" rows={3} {...register("description")} />
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
              {errors.initialQuantity && (
                <p className="text-sm text-destructive">{errors.initialQuantity.message}</p>
              )}
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
                  <p className="text-sm text-destructive">{errors.initialUnitCost.message}</p>
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
                {marginPercent(watch("defaultSalePrice")) != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.productsAdd.marginLabel")}:{" "}
                    {marginPercent(watch("defaultSalePrice"))?.toFixed(1)}%
                  </p>
                )}
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
                  {marginPercent(categoryPriceValue(category.id)) != null && (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.productsAdd.marginLabel")}:{" "}
                      {marginPercent(categoryPriceValue(category.id))?.toFixed(1)}%
                    </p>
                  )}
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
                    accept="image/*"
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
