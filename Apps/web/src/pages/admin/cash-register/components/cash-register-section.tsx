import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { CashRegisterDrill } from "@dragon-telecom/contract";
import type { CashRegisterFigure } from "@/types/cash-register.types";

interface CashRegisterSectionProps {
  titleKey: string;
  icon: ReactNode;
  figures: CashRegisterFigure[];
  /** Absent (the staff dashboard) = every figure is a plain, non-clickable card. */
  onDrill?: (drill: CashRegisterDrill, labelKey: string) => void;
}

// S33 — one Caisse section (Sales, Returns, Repairs, Orders, Suppliers). Presentational: the
// page formats every value; a figure carrying a `drill` target opens the documents behind it.
// S35 — without onDrill (the staff dashboard) every figure is a plain card.
export function CashRegisterSection({
  titleKey,
  icon,
  figures,
  onDrill,
}: CashRegisterSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {t(titleKey)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {figures.map((figure) => {
            const card = (
              <StatCard
                icon={icon}
                label={t(figure.labelKey)}
                value={figure.value}
                trend={
                  figure.detail ? (
                    <span className="text-xs text-muted-foreground">{figure.detail}</span>
                  ) : figure.drill && onDrill ? (
                    <span className="text-xs text-muted-foreground">
                      {t("admin.cashRegister.drill.hint")}
                    </span>
                  ) : undefined
                }
              />
            );
            if (!figure.drill || !onDrill) return <div key={figure.labelKey}>{card}</div>;
            const drill = figure.drill;
            return (
              <button
                key={figure.labelKey}
                type="button"
                className="rounded-2xl text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => onDrill(drill, figure.labelKey)}
                aria-label={t("admin.cashRegister.drill.open", { label: t(figure.labelKey) })}
              >
                {card}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
