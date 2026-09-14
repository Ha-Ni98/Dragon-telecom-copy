import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResolvedVsChargedPrice } from "@/components/shared/ResolvedVsChargedPrice";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShoppingCart } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// Client-side draft state — not a persisted SaleDto (the draft is PATCHed incrementally,
// STF-02 §Forms); field names mirror SaleDraftCommand's line shape (sales.command.ts) plus
// the display-only `productName`/`resolvedPrice`/`lineTotal` the ticket needs to render.
export interface PosTicketLine {
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  resolvedPrice: number;
  unitPrice: number;
  lineTotal: number;
  serialNumbers?: string[];
}

interface PosTicketProps {
  lines: PosTicketLine[];
  total: number;
  onQuantityChange: (productId: string, quantity: number) => void;
  onUnitPriceChange: (productId: string, unitPrice: number) => void;
  onSerialNumbersChange: (productId: string, serialNumbers: string[]) => void;
  onRemoveLine: (productId: string) => void;
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires POS state management around this. The discount is
// intentionally not editable from the POS (S6/I6) — Sale.discountAmount still exists as a column
// and is always written as 0 from this ticket.
//
// S29 — the fixed columns (qty stepper, charged-price input, resolved-vs-charged, line total,
// remove button) sum to ≈424px; that figure is what lets the ticket pane shrink to the lg
// breakpoint's ~408px without the page scrolling sideways (see the S29 plan §1.2 for the
// arithmetic). Widening any of them needs that arithmetic redone against the layout's actual
// available width.
export function PosTicket({
  lines,
  total,
  onQuantityChange,
  onUnitPriceChange,
  onSerialNumbersChange,
  onRemoveLine,
}: PosTicketProps) {
  const { t, language } = useTranslation();

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-6 w-6" />}
        title={t("staff.pos.ticket.title")}
        body={t("staff.pos.ticket.empty")}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* S29 — overflow-x-auto is a containment guarantee: if a future addition ever pushes a row
          past the pane again, it scrolls INSIDE this card instead of scrolling the whole page,
          which is the defect this set exists to remove. */}
      <div className="divide-y divide-border overflow-x-auto">
        {lines.map((line) => (
          <div key={line.productId} className="flex items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium" title={line.productName}>
                {line.productName}
              </div>
              {line.serialNumbers && line.serialNumbers.length > 0 && (
                <div
                  className="truncate text-xs text-muted-foreground"
                  title={line.serialNumbers.join(", ")}
                >
                  {t("staff.pos.ticket.serials")}: {line.serialNumbers.join(", ")}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onQuantityChange(line.productId, Math.max(1, line.quantity - 1))}
                aria-label={t("common.actions.decrease")}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm">{line.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={line.quantity >= line.availableQuantity}
                onClick={() =>
                  onQuantityChange(
                    line.productId,
                    Math.min(line.availableQuantity, line.quantity + 1),
                  )
                }
                aria-label={t("common.actions.increase")}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <Input
              type="number"
              min={0}
              value={line.unitPrice}
              onChange={(e) => onUnitPriceChange(line.productId, Number(e.target.value))}
              className="w-20 shrink-0"
              aria-label={t("staff.pos.ticket.chargedPrice")}
            />

            <div className="w-20 shrink-0 text-right">
              <ResolvedVsChargedPrice
                resolvedPrice={line.resolvedPrice}
                unitPrice={line.unitPrice}
              />
            </div>

            <div className="w-20 shrink-0 text-right font-semibold">
              {formatDZD(line.lineTotal, language)}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onRemoveLine(line.productId)}
              aria-label={t("staff.pos.ticket.remove")}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border p-4">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>{t("staff.pos.ticket.total")}</span>
          <span>{formatDZD(total, language)}</span>
        </div>
      </div>
    </div>
  );
}
