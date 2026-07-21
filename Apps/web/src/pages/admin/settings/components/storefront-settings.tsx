import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Info, X, Save } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface FeaturedProduct {
  id: string;
  name: string;
}

interface StorefrontSettingsProps {
  featuredProducts: FeaturedProduct[];
  productOptions: AutocompleteOption[];
  onAdd: (productId: string) => void;
  onRemove: (productId: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

// ADM-17 Storefront tab — featured-products picker only (gap A3: delivery-companies scoped
// out, `SettingsDto.storefront` carries only `featuredProductIds`). Dumb (owns only local
// picker state); Sprint 8 wires `usePlatformSettings`/`useUpdatePlatformSettings`.
export function StorefrontSettings({
  featuredProducts,
  productOptions,
  onAdd,
  onRemove,
  onSave,
  isSaving = false,
}: StorefrontSettingsProps) {
  const { t } = useTranslation();
  const [pickerValue, setPickerValue] = useState("");

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{t("admin.settings.storefront.deliveryCompaniesNote")}</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <span className="text-sm font-medium">
          {t("admin.settings.storefront.featuredProducts")}
        </span>
        <AutocompleteInput
          value={pickerValue}
          onChange={(value) => {
            setPickerValue("");
            if (value) onAdd(value);
          }}
          suggestions={productOptions}
          disabled={isSaving}
        />
        <div className="flex flex-wrap gap-2">
          {featuredProducts.map((product) => (
            <Badge key={product.id} variant="secondary" className="gap-1">
              {product.name}
              <button type="button" onClick={() => onRemove(product.id)} disabled={isSaving}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <Button onClick={onSave} disabled={isSaving}>
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}
