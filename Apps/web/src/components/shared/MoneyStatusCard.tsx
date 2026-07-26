import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface MoneyStatusCardProps {
  /** Amount owed by the client (ClientMeDto.credit) */
  credit: number;
  /** Lifetime amount paid (ClientMeDto.totalPaid) */
  totalPaid: number;
  /** Lifetime purchases (ClientMeDto.totalSold) */
  totalSold: number;
}

export function MoneyStatusCard({ credit, totalPaid, totalSold }: MoneyStatusCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t('account.creditsBalance')}
        </CardTitle>
        <CardDescription>
          {t('account.creditsBalanceDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Credit (owed) - Red */}
          <div
            className="text-center p-4 border rounded-lg bg-red-50 dark:bg-red-950/20"
            role="region"
            aria-label={`${t('account.credit')}: ${credit.toLocaleString()} DA`}
          >
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
              {credit.toLocaleString()} DA
            </div>
            <div className="text-sm text-red-700 dark:text-red-300 font-medium">
              {t('account.credit')}
            </div>
          </div>

          {/* Total Paid - Green */}
          <div
            className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/20"
            role="region"
            aria-label={`${t('account.totalPaid')}: ${totalPaid.toLocaleString()} DA`}
          >
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
              {totalPaid.toLocaleString()} DA
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">
              {t('account.totalPaid')}
            </div>
          </div>

          {/* Total Sold (lifetime purchases) - Blue */}
          <div
            className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20"
            role="region"
            aria-label={`${t('account.totalSold')}: ${totalSold.toLocaleString()} DA`}
          >
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {totalSold.toLocaleString()} DA
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              {t('account.totalSold')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
