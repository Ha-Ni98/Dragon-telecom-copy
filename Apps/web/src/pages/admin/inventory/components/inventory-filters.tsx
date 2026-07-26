import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MovementType } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

export interface MovementFiltersValue {
  type?: MovementType;
  from?: string;
  to?: string;
}

interface InventoryFiltersProps {
  value: MovementFiltersValue;
  onChange: (value: MovementFiltersValue) => void;
  disabled?: boolean;
}

// ADM-06 Movement ledger tab filters — MovementsQuery (inventory.query.ts): `type`/`from`/`to`
// (product/staff filters exist on the query too but have no obvious UI source list here yet —
// left for Sprint 5 to add once the movements table's own data suggests a product/staff
// picker; date range + type cover the query's simplest, always-available filters).
export function InventoryFilters({ value, onChange, disabled = false }: InventoryFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
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
          <SelectItem value="all">{t("common.labels.status")}</SelectItem>
          {Object.values(MovementType).map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
