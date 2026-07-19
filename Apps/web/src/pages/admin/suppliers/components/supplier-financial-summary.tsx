import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { SupplierWithDetails } from '@/types/draft-types';

interface SupplierFinancialSummaryProps {
  supplier: SupplierWithDetails;
}

/**
 * Supplier Financial Summary Component
 * Displays financial information and statistics for the supplier
 */
export function SupplierFinancialSummary({ supplier }: SupplierFinancialSummaryProps) {
  const { t } = useTranslation();

  // Calculate financial ratios and indicators
  const totalDue = supplier.totalDue || 0;
  const totalPaid = supplier.totalPaid || 0;
  const totalCredit = supplier.totalCredit || 0;
  const supplierCredit = supplier.supplierCredit || 0;
  
  const totalTransactions = totalDue + totalPaid;
  const paymentRatio = totalTransactions > 0 ? (totalPaid / totalTransactions) * 100 : 0;
  const creditUtilization = supplierCredit > 0 ? (totalCredit / supplierCredit) * 100 : 0;

  // Determine financial health status
  const getFinancialHealth = () => {
    if (totalDue === 0 && totalPaid > 0) {
      return { status: 'excellent', color: 'green', text: t('admin.suppliers.financialHealth.excellent') };
    }
    if (paymentRatio >= 80) {
      return { status: 'good', color: 'blue', text: t('admin.suppliers.financialHealth.good') };
    }
    if (paymentRatio >= 60) {
      return { status: 'fair', color: 'yellow', text: t('admin.suppliers.financialHealth.fair') };
    }
    return { status: 'poor', color: 'red', text: t('admin.suppliers.financialHealth.poor') };
  };

  const financialHealth = getFinancialHealth();

  return (
    <Card role="region" aria-labelledby="financial-summary-title">
      <CardHeader>
        <CardTitle id="financial-summary-title" className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" aria-hidden="true" />
          {t('admin.suppliers.financialSummary')}
        </CardTitle>
        <CardDescription>
          {t('admin.suppliers.financialSummaryDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Financial Health Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            {financialHealth.status === 'excellent' || financialHealth.status === 'good' ? (
              <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            )}
            <div>
              <p className="font-medium">{t('admin.suppliers.financialHealth.title')}</p>
              <p className="text-sm text-muted-foreground">{financialHealth.text}</p>
            </div>
          </div>
          <Badge 
            variant={financialHealth.status === 'excellent' ? 'default' : 'secondary'}
            className={`${
              financialHealth.status === 'excellent' ? 'bg-green-100 text-green-800' :
              financialHealth.status === 'good' ? 'bg-blue-100 text-blue-800' :
              financialHealth.status === 'fair' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}
            aria-label={`Financial health status: ${financialHealth.status}`}
          >
            {financialHealth.status.toUpperCase()}
          </Badge>
        </div>

        {/* Financial Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Due */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-muted-foreground">
                {t('admin.suppliers.totalDue')}
              </span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {(supplier.totalDue || 0).toLocaleString()} DZD
            </p>
            <p className="text-xs text-muted-foreground">
              {t('admin.suppliers.outstandingAmount')}
            </p>
          </div>

          {/* Total Paid */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">
                {t('admin.suppliers.totalPaid')}
              </span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {(supplier.totalPaid || 0).toLocaleString()} DZD
            </p>
            <p className="text-xs text-muted-foreground">
              {paymentRatio.toFixed(1)}% {t('admin.suppliers.paymentRatio')}
            </p>
          </div>

          {/* Total Credit */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">
                {t('admin.suppliers.totalCredit')}
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {(supplier.totalCredit || 0).toLocaleString()} DZD
            </p>
            <p className="text-xs text-muted-foreground">
              {creditUtilization.toFixed(1)}% {t('admin.suppliers.creditUtilization')}
            </p>
          </div>

          {/* Invoices Count */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">
                {t('admin.suppliers.invoices')}
              </span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {supplier.invoicesCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('admin.suppliers.totalInvoices')}
            </p>
          </div>
        </div>

        <Separator />

        {/* Additional Financial Information */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">{t('admin.suppliers.additionalInfo')}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment History */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{t('admin.suppliers.paymentHistory')}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{t('admin.suppliers.paidAmount')}</span>
                  <span className="font-medium text-green-600">
                    {(supplier.totalPaid || 0).toLocaleString()} DZD
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('admin.suppliers.outstandingAmount')}</span>
                  <span className="font-medium text-red-600">
                    {(supplier.totalDue || 0).toLocaleString()} DZD
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('admin.suppliers.totalTransactions')}</span>
                  <span className="font-medium">
                    {(totalTransactions || 0).toLocaleString()} DZD
                  </span>
                </div>
              </div>
            </div>

            {/* Credit Information */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">{t('admin.suppliers.creditInfo')}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{t('admin.suppliers.creditLimit')}</span>
                  <span className="font-medium">
                    {(supplier.supplierCredit || 0).toLocaleString()} DZD
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('admin.suppliers.creditUsed')}</span>
                  <span className="font-medium text-blue-600">
                    {(supplier.totalCredit || 0).toLocaleString()} DZD
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('admin.suppliers.creditAvailable')}</span>
                  <span className="font-medium text-green-600">
                    {((supplier.supplierCredit || 0) - (supplier.totalCredit || 0)).toLocaleString()} DZD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Health Indicators */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">{t('admin.suppliers.healthIndicators')}</h4>
          
          <div className="space-y-2">
            {/* Payment Ratio Indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('admin.suppliers.paymentRatio')}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      paymentRatio >= 80 ? 'bg-green-500' :
                      paymentRatio >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(paymentRatio, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{paymentRatio.toFixed(1)}%</span>
              </div>
            </div>

            {/* Credit Utilization Indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('admin.suppliers.creditUtilization')}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      creditUtilization >= 80 ? 'bg-red-500' :
                      creditUtilization >= 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{creditUtilization.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
