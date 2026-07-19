import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PricingCalculationResult } from "@/types/draft-types";
import { ClientCategory } from "@/types/draft-types/admin-product-add.types";
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Props for the PricingSummary component
 */
interface PricingSummaryProps {
  calculation: PricingCalculationResult;
  categories: ClientCategory[];
  unitPrice: number;
  quantity: number;
  onShowDetails?: () => void;
  className?: string;
}

/**
 * Pricing summary component
 */
export function PricingSummary({
  calculation,
  categories,
  unitPrice,
  quantity,
  onShowDetails,
  className
}: PricingSummaryProps) {
  const { t } = useTranslation();
  /**
   * Format currency
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  /**
   * Get status color
   */
  const getStatusColor = (isValid: boolean, hasErrors: boolean) => {
    if (hasErrors) return "text-red-600";
    if (isValid) return "text-green-600";
    return "text-yellow-600";
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (isValid: boolean, hasErrors: boolean) => {
    if (hasErrors) return <AlertTriangle className="h-4 w-4" />;
    if (isValid) return <CheckCircle className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const hasErrors = calculation.errors.length > 0;
  const hasValidPrices = Object.values(calculation.categoryBreakdown).some(price => price > 0);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <CardTitle className="text-lg">{t('admin.products.pricingSummary.title')}</CardTitle>
          </div>
          <Badge 
            variant={hasErrors ? "destructive" : hasValidPrices ? "default" : "secondary"}
            className="flex items-center space-x-1"
          >
            {getStatusIcon(calculation.isValid, hasErrors)}
            <span>{hasErrors ? t('admin.products.pricingSummary.errors') : hasValidPrices ? t('admin.products.pricingSummary.valid') : t('admin.products.pricingSummary.incomplete')}</span>
          </Badge>
        </div>
        <CardDescription>
          {t('admin.products.pricingSummary.subtitle')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(calculation.totalRevenue)}
            </p>
            <p className="text-sm text-muted-foreground">{t('admin.products.pricingSummary.totalRevenue')}</p>
          </div>
          
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(calculation.averagePrice)}
            </p>
            <p className="text-sm text-muted-foreground">{t('admin.products.pricingSummary.averagePrice')}</p>
          </div>
          
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Calculator className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {quantity}
            </p>
            <p className="text-sm text-muted-foreground">{t('admin.products.pricingSummary.quantity')}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center">
            <TrendingDown className="h-4 w-4 mr-2" />
            {t('admin.products.pricingSummary.categoryBreakdown')}
          </h4>
          <div className="space-y-2">
            {categories.map((category) => {
              const price = calculation.categoryBreakdown[category.idCategory] || 0;
              const revenue = price * quantity;
              const isSet = price > 0;
              const ratio = unitPrice > 0 ? (price / unitPrice) : 0;
              
              return (
                <div 
                  key={category.idCategory} 
                  className={cn(
                    "flex justify-between items-center p-3 rounded-lg border",
                    isSet ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isSet ? "bg-green-500" : "bg-gray-400"
                    )} />
                    <div>
                      <p className="text-sm font-medium">{category.categoryName}</p>
                      {category.description && (
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {isSet ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-green-700">
                          {formatCurrency(price)}
                        </p>
                        <p className="text-xs text-green-600">
                          {t('admin.products.pricingSummary.revenue')}: {formatCurrency(revenue)}
                        </p>
                        {ratio > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {ratio < 1 ? t('admin.products.pricingSummary.discount', { percent: Math.round((1 - ratio) * 100) }) :
                             ratio > 1 ? t('admin.products.pricingSummary.markup', { percent: Math.round((ratio - 1) * 100) }) :
                             t('admin.products.pricingSummary.sameAsUnitPrice')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('admin.products.pricingSummary.notSet')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation Errors */}
        {hasErrors && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800">{t('admin.products.pricingSummary.validationErrors')}</p>
                <ul className="text-sm text-red-700 space-y-1">
                  {calculation.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Unit Price Reference */}
        {unitPrice > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-800">{t('admin.products.pricingSummary.unitPriceReference')}</p>
                <p className="text-sm text-blue-700">
                  {t('admin.products.pricingSummary.baseUnitPrice')}: {formatCurrency(unitPrice)} |
                  {t('admin.products.pricingSummary.totalAtUnitPrice')}: {formatCurrency(unitPrice * quantity)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {onShowDetails && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={onShowDetails}
              className="w-full sm:w-auto"
            >
              <Calculator className="h-4 w-4 mr-2" />
              {t('admin.products.pricingSummary.viewDetailedCalc')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
