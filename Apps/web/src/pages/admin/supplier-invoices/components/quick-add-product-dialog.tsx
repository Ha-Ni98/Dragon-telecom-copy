import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import {
  quickAddProductSchema,
  type QuickAddProductFormValues,
} from "@/pages/admin/supplier-invoices/components/quick-add-product.schema";
import {
  useCatalogFamilies,
  useCatalogBrands,
  useCatalogModels,
  useCreateCatalogFamily,
  useCreateCatalogBrand,
  useCreateCatalogModel,
} from "@/hooks/useCatalogTaxonomy";
import { useTranslation } from "@/hooks/useTranslation";
import { FieldError } from "@/components/shared/FieldError";

interface QuickAddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: QuickAddProductFormValues) => void;
  isSaving?: boolean;
}

// ADM-08 — S7 I5 rebuild: family → brand → model → name, each taxonomy field an
// AutocompleteInput with its own quick-add, ported from AdminProductsAdd.tsx's own pattern
// rather than inventing a second one. The model input is disabled until a brand is chosen, and
// the name auto-fills as "family brand model" until the user types over it.
export function QuickAddProductDialog({
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: QuickAddProductDialogProps) {
  const { t } = useTranslation();

  const { data: families } = useCatalogFamilies({}, true);
  const { data: brands } = useCatalogBrands(true);
  const [selectedBrandId, setSelectedBrandId] = useState<string>();
  const { data: models } = useCatalogModels({ brandId: selectedBrandId }, true, {
    enabled: !!selectedBrandId,
  });

  const createFamily = useCreateCatalogFamily();
  const createBrand = useCreateCatalogBrand();
  const createModel = useCreateCatalogModel();

  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const form = useForm<QuickAddProductFormValues>({
    resolver: zodResolver(quickAddProductSchema(t)),
    defaultValues: { name: "", initialQuantity: 0 },
  });
  const { register, handleSubmit, watch, setValue, reset, formState } = form;
  const { errors } = formState;

  const [familyId, brandId, modelId] = watch(["familyId", "brandId", "modelId"]);
  const familyName = families?.find((f) => f.id === familyId)?.name ?? "";
  const brandName = brands?.find((b) => b.id === brandId)?.name ?? "";
  const modelName = models?.find((m) => m.id === modelId)?.name ?? "";

  const recomputeName = (nextFamily: string, nextBrand: string, nextModel: string) => {
    if (nameManuallyEdited) return;
    const parts = [nextFamily, nextBrand, nextModel].filter(Boolean);
    if (parts.length) setValue("name", parts.join(" "));
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset({ name: "", initialQuantity: 0 });
      setNameManuallyEdited(false);
      setSelectedBrandId(undefined);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("admin.supplierInvoices.editor.createProduct")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1">
            <Label>{t("admin.productsAdd.familyLabel")}</Label>
            <AutocompleteInput
              inputId="quick-add-family"
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
              disabled={isSaving}
            />
            {errors.familyId && <FieldError>{errors.familyId.message}</FieldError>}
          </div>

          <div className="space-y-1">
            <Label>{t("admin.productsAdd.brandLabel")}</Label>
            <AutocompleteInput
              inputId="quick-add-brand"
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
              disabled={isSaving}
            />
            {errors.brandId && <FieldError>{errors.brandId.message}</FieldError>}
          </div>

          <div className="space-y-1">
            <Label>{t("admin.productsAdd.modelLabel")}</Label>
            <AutocompleteInput
              inputId="quick-add-model"
              value={modelId ?? ""}
              onChange={(value) => {
                const model = models?.find((m) => m.id === value);
                if (model) {
                  setValue("modelId", model.id);
                  recomputeName(familyName, brandName, model.name);
                }
              }}
              suggestions={(models ?? []).map((m) => ({ value: m.id, label: m.name }))}
              disabled={!brandId || isSaving}
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
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="quick-add-name">{t("admin.productsAdd.nameLabel")}</Label>
            <Input
              id="quick-add-name"
              {...register("name", { onChange: () => setNameManuallyEdited(true) })}
              disabled={isSaving}
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
