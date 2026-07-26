import { ArrowLeft, Save, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { AdminProductDto } from "@dragon-telecom/contract";

interface ProductInformationHeaderProps {
  product: AdminProductDto;
  isEditMode: boolean;
  isSaving: boolean;
  onBack: () => void;
  onToggleEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

// Set-03 Sprint 5 rewire — dumb, DTO-typed (was numeric-id ProductInformationFormData-shaped
// props). Single Edit/Save/Cancel spanning every card below (ADM-04 §Layout).
export function ProductInformationHeader({
  product,
  isEditMode,
  isSaving,
  onBack,
  onToggleEdit,
  onSave,
  onCancel,
}: ProductInformationHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">{product.barcode ?? "—"}</p>
        </div>
      </div>

      {isEditMode ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            {t("admin.productInfo.cancel")}
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {t("admin.productInfo.save")}
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={onToggleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          {t("admin.productInfo.edit")}
        </Button>
      )}
    </div>
  );
}
