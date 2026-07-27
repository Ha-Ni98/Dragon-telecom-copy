import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceSource } from "@dragon-telecom/contract";
import { SOURCE_LABEL_KEY } from "@/pages/staff/invoices/components/InvoicesTable";
import { useTranslation } from "@/hooks/useTranslation";

type SourceFilterValue = InvoiceSource | "all";

interface InvoiceFiltersBarProps {
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string; source?: InvoiceSource }) => void;
  /** Outgoing tab only — omit to render just the date range. */
  source?: InvoiceSource;
  showSource?: boolean;
}

// S8 J7/J8 — shared by the outgoing (with the source select), incoming and payments tabs (date
// range only). An empty date input sends `undefined`, never `""` — `z.iso.date()` rejects the
// empty string outright.
export function InvoiceFiltersBar({
  from,
  to,
  onChange,
  source,
  showSource = false,
}: InvoiceFiltersBarProps) {
  const { t } = useTranslation();
  const sourceValue: SourceFilterValue = source ?? "all";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="invoice-filter-from">{t("admin.invoices.filters.from")}</Label>
        <Input
          id="invoice-filter-from"
          type="date"
          value={from ?? ""}
          onChange={(e) => onChange({ from: e.target.value || undefined, to, source })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invoice-filter-to">{t("admin.invoices.filters.to")}</Label>
        <Input
          id="invoice-filter-to"
          type="date"
          value={to ?? ""}
          onChange={(e) => onChange({ from, to: e.target.value || undefined, source })}
        />
      </div>
      {showSource && (
        <div className="w-full space-y-1 sm:w-48">
          <Label htmlFor="invoice-filter-source">{t("admin.invoices.filters.source")}</Label>
          <Select
            value={sourceValue}
            onValueChange={(value) =>
              onChange({
                from,
                to,
                source: value === "all" ? undefined : (value as InvoiceSource),
              })
            }
          >
            <SelectTrigger id="invoice-filter-source" className="w-full">
              <SelectValue placeholder={t("admin.invoices.filters.allSources")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.invoices.filters.allSources")}</SelectItem>
              {Object.values(InvoiceSource).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(SOURCE_LABEL_KEY[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
