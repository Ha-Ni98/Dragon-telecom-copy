import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface MoneyStatusCardProps {
  balance: number;
  paid: number;
  credit: number;
}

export function MoneyStatusCard({ balance, paid, credit }: MoneyStatusCardProps) {
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
          {/* Balance - Blue */}
          <div 
            className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20"
            role="region"
            aria-label={`Balance: ${balance.toLocaleString()} DA`}
          >
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {balance.toLocaleString()} DA
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              {t('account.balance')}
            </div>
          </div>
          
          {/* Paid - Green */}
          <div 
            className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/20"
            role="region"
            aria-label={`Paid: ${paid.toLocaleString()} DA`}
          >
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
              {paid.toLocaleString()} DA
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">
              {t('account.paid')}
            </div>
          </div>
          
          {/* Credit - Red */}
          <div 
            className="text-center p-4 border rounded-lg bg-red-50 dark:bg-red-950/20"
            role="region"
            aria-label={`Credit: ${credit.toLocaleString()} DA`}
          >
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
              {credit.toLocaleString()} DA
            </div>
            <div className="text-sm text-red-700 dark:text-red-300 font-medium">
              {t('account.credit')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
