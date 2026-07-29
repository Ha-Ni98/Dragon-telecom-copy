import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CheckCircle, FileText, CreditCard } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { SupplierDto } from "@dragon-telecom/contract";

interface SupplierFinancialSummaryProps {
  supplier: SupplierDto;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-07 detail — retyped off SupplierDto. The old view-model's invented "financial health"
// score, payment ratio, and credit-utilization bars had no DTO-backed fields (`totalDue`,
// `creditUtilization`) to compute from — dropped per Sprint 3 §Risks ("fix at the presentational
// layer, not by casting") rather than fabricated.
export function SupplierFinancialSummary({ supplier }: SupplierFinancialSummaryProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {t("admin.suppliers.financialSummary")}
        </CardTitle>
        <CardDescription>{t("admin.suppliers.financialSummaryDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              {t("admin.suppliers.credit")}
            </div>
            <p className="text-2xl font-bold">{formatCurrency(supplier.credit)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-success" />
              {t("admin.suppliers.totalPaid")}
            </div>
            <p className="text-2xl font-bold">{formatCurrency(supplier.totalPaid)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t("admin.suppliers.stats.totalInvoiced")}
            </div>
            <p className="text-2xl font-bold">{formatCurrency(supplier.totalInvoiced)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
