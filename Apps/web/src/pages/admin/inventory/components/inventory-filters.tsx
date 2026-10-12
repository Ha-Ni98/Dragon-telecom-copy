import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { MovementType } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { MOVEMENT_TYPE_LABEL_KEY } from "@/pages/admin/inventory/movement-type-labels";
import { MovementTypeLegend } from "@/pages/admin/inventory/components/movement-type-legend";

export interface MovementFiltersValue {
  type?: MovementType;
  from?: string;
  to?: string;
}

interface InventoryFiltersProps {
  value: MovementFiltersValue;
  onChange: (value: MovementFiltersValue) => void;
  search: string;
  onSearchChange: (value: string) => void;
  disabled?: boolean;
}

// ADM-06 Movement ledger tab filters — MovementsQuery (inventory.query.ts): `search`/`type`/
// `from`/`to`. `search` matches the movement's product by name or barcode (S4) and is *not* part
// of MovementFiltersValue: the page debounces it separately, since MovementFiltersValue is applied
// to the query immediately on every change. The `staffId` filter still has no UI (no staff picker
// on this page); `productId` is now covered by the free-text search.
export function InventoryFilters({
  value,
  onChange,
  search,
  onSearchChange,
  disabled = false,
}: InventoryFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("admin.inventory.movements.filters.search")}
          disabled={disabled}
          className="pl-9"
        />
      </div>
      <Select
        value={value.type ?? "all"}
        onValueChange={(v) =>
          onChange({ ...value, type: v === "all" ? undefined : (v as MovementType) })
        }
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder={t("admin.inventory.movements.filters.type")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("admin.inventory.movements.filters.allTypes")}</SelectItem>
          {Object.values(MovementType).map((type) => (
            <SelectItem key={type} value={type}>
              {t(MOVEMENT_TYPE_LABEL_KEY[type])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* S30 — what each movement type means (translated labels + a legend line each). */}
      <MovementTypeLegend />
      <Input
        type="date"
        value={value.from ?? ""}
        onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        disabled={disabled}
        className="w-full sm:w-40"
      />
      <Input
        type="date"
        value={value.to ?? ""}
        onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        disabled={disabled}
        className="w-full sm:w-40"
      />
    </div>
  );
}
