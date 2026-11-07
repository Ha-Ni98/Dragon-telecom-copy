import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDZD } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { StaffCashRegisterDto } from "@dragon-telecom/contract";
import type { CashMovementLine } from "@/types/cash-register.types";

interface CashMovementCardProps {
  cash: StaffCashRegisterDto["cashMovement"];
}

// S35 — the day's net cash movement: what should be in the drawer, line by line. The labels carry
// their own +/−/= signs, so amounts are shown unsigned (only the net can be negative). Every
// number is computed by the server; this component does no arithmetic.
export function CashMovementCard({ cash }: CashMovementCardProps) {
  const { t, language } = useTranslation();

  const lines: CashMovementLine[] = [
    { labelKey: "admin.cashRegister.cash.salesPaid", amount: cash.salesPaid },
    { labelKey: "admin.cashRegister.cash.repairsPaid", amount: cash.repairsPaid },
    { labelKey: "admin.cashRegister.cash.ordersPaid", amount: cash.ordersPaid },
    { labelKey: "admin.cashRegister.cash.clientPayments", amount: cash.clientPayments },
    { labelKey: "admin.cashRegister.cash.refunds", amount: cash.refunds },
    { labelKey: "admin.cashRegister.cash.supplierPayments", amount: cash.supplierPayments },
    { labelKey: "admin.cashRegister.cash.net", amount: cash.net, isTotal: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.cashRegister.cash.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lines.map((line) => (
          <div
            key={line.labelKey}
            className={cn(
              "flex items-center justify-between gap-3 text-sm",
              line.isTotal && "border-t border-border pt-2 font-semibold",
            )}
          >
            <span className={line.isTotal ? undefined : "text-muted-foreground"}>
              {t(line.labelKey)}
            </span>
            <span>{formatDZD(line.amount, language)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
