import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MovementType } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import {
  MOVEMENT_TYPE_HELP_KEY,
  MOVEMENT_TYPE_LABEL_KEY,
} from "@/pages/admin/inventory/movement-type-labels";

// S30 — UI-only grouping of the movement types by what they do to stock. Reservations
// (PENDING) are listed separately and say so in their heading: they never change on-hand, which
// is the distinction a reader of the ledger most needs (a REPAIR_CANCELLED row, for instance,
// releases a reservation — nothing came back onto the shelf because nothing ever left it).
const LEGEND_GROUPS: { headingKey: string; types: MovementType[] }[] = [
  {
    headingKey: "admin.inventory.movements.legend.group.in",
    types: [
      MovementType.SUPPLIER_INVOICE,
      MovementType.INITIAL_STOCK,
      MovementType.ADJUSTMENT_IN,
      MovementType.RETURN_IN,
      MovementType.REPAIR_RETURN,
    ],
  },
  {
    headingKey: "admin.inventory.movements.legend.group.out",
    types: [
      MovementType.SALE,
      MovementType.ORDER_OUT,
      MovementType.REPAIR_CONSUMPTION,
      MovementType.ADJUSTMENT_OUT,
    ],
  },
  {
    headingKey: "admin.inventory.movements.legend.group.pending",
    types: [
      MovementType.PENDING_ORDER,
      MovementType.PENDING_REPAIR,
      MovementType.PENDING_RELEASE,
      MovementType.REPAIR_CANCELLED,
    ],
  },
];

// S30 — the ledger's type legend: an ⓘ button beside the type filter opening a popover that
// explains every movement type, in three groups.
export function MovementTypeLegend() {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("admin.inventory.movements.legend.open")}
        >
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-96 w-96 overflow-y-auto">
        <h4 className="mb-2 font-semibold">{t("admin.inventory.movements.legend.title")}</h4>
        <div className="space-y-3">
          {LEGEND_GROUPS.map((group) => (
            <div key={group.headingKey} className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {t(group.headingKey)}
              </div>
              <ul className="space-y-1 text-sm">
                {group.types.map((type) => (
                  <li key={type}>
                    <span className="font-medium">{t(MOVEMENT_TYPE_LABEL_KEY[type])}</span>
                    <div className="text-xs text-muted-foreground">
                      {t(MOVEMENT_TYPE_HELP_KEY[type])}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
