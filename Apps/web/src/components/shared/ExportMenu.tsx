import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export type ExportMenuItem = {
  key: string; // stable react key, e.g. "csv" | "xlsx" | "pdf"
  labelKey: string; // translation key — the caller owns the wording, since the format set
  // differs per surface (delivery fees also offers Excel, to pair with its Excel importer)
  onSelect: () => void;
};

interface ExportMenuProps {
  items: ExportMenuItem[];
  disabled?: boolean;
  isPending?: boolean; // renders the "exporting…" label and blocks the trigger
}

// S25 — one dropdown shared by all four export surfaces (delivery fees, stock levels, the
// movement ledger, statistics reports) so a fifth export never invents a fifth toolbar idiom.
export function ExportMenu({ items, disabled, isPending }: ExportMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isPending}>
          <Download className="mr-2 h-4 w-4" />
          {isPending ? t("common.actions.exporting") : t("common.actions.export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.key} onSelect={item.onSelect}>
            {t(item.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
