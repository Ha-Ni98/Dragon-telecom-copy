/**
 * Revenue calculation utilities for product pricing
 */

export interface RevenueCalculation {
  purchasePrice: number;
  sellingPrice: number;
  revenue: number;
  revenuePercentage: number;
  profit: number;
  isValid: boolean;
  error?: string;
}

export interface PricingTier {
  categoryId: number;
  categoryName: string;
  price: number;
  revenue: number;
  revenuePercentage: number;
  profit: number;
}

/**
 * Calculate revenue for a single price point
 */
export function calculateRevenue(
  purchasePrice: number, 
  sellingPrice: number
): RevenueCalculation {
  // Validate inputs
  if (purchasePrice <= 0) {
    return {
      purchasePrice,
      sellingPrice,
      revenue: 0,
      revenuePercentage: 0,
      profit: 0,
      isValid: false,
      error: 'Purchase price must be greater than 0'
    };
  }

  if (sellingPrice <= 0) {
    return {
      purchasePrice,
      sellingPrice,
      revenue: 0,
      revenuePercentage: 0,
      profit: 0,
      isValid: false,
      error: 'Selling price must be greater than 0'
    };
  }

  if (sellingPrice < purchasePrice) {
    return {
      purchasePrice,
      sellingPrice,
      revenue: sellingPrice - purchasePrice,
      revenuePercentage: ((sellingPrice - purchasePrice) / purchasePrice) * 100,
      profit: sellingPrice - purchasePrice,
      isValid: false,
      error: 'Selling price is below purchase price (loss)'
    };
  }

  const profit = sellingPrice - purchasePrice;
  const revenuePercentage = (profit / purchasePrice) * 100;

  return {
    purchasePrice,
    sellingPrice,
    revenue: profit,
    revenuePercentage,
    profit,
    isValid: true
  };
}

/**
 * Calculate revenue for multiple pricing tiers
 */
export function calculatePricingTiers(
  purchasePrice: number,
  categoryPrices: Record<string, number>,
  categories: Array<{ idCategory: number; categoryName: string }>
): PricingTier[] {
  return categories.map(category => {
    const price = categoryPrices[category.idCategory.toString()] || 0;
    const revenue = calculateRevenue(purchasePrice, price);
    
    return {
      categoryId: category.idCategory,
      categoryName: category.categoryName,
      price,
      revenue: revenue.revenue,
      revenuePercentage: revenue.revenuePercentage,
      profit: revenue.profit
    };
  });
}

/**
 * Get revenue summary for all pricing tiers
 */
export function getRevenueSummary(tiers: PricingTier[]): {
  totalRevenue: number;
  averageRevenuePercentage: number;
  bestTier: PricingTier | null;
  worstTier: PricingTier | null;
  profitableTiers: number;
  totalTiers: number;
} {
  if (tiers.length === 0) {
    return {
      totalRevenue: 0,
      averageRevenuePercentage: 0,
      bestTier: null,
      worstTier: null,
      profitableTiers: 0,
      totalTiers: 0
    };
  }

  const profitableTiers = tiers.filter(tier => tier.revenue > 0);
  const totalRevenue = tiers.reduce((sum, tier) => sum + tier.revenue, 0);
  const averageRevenuePercentage = tiers.reduce((sum, tier) => sum + tier.revenuePercentage, 0) / tiers.length;
  
  const bestTier = tiers.reduce((best, current) => 
    current.revenuePercentage > best.revenuePercentage ? current : best
  );
  
  const worstTier = tiers.reduce((worst, current) => 
    current.revenuePercentage < worst.revenuePercentage ? current : worst
  );

  return {
    totalRevenue,
    averageRevenuePercentage,
    bestTier,
    worstTier,
    profitableTiers: profitableTiers.length,
    totalTiers: tiers.length
  };
}

/**
 * Format revenue percentage for display
 */
export function formatRevenuePercentage(percentage: number): string {
  if (percentage === 0) return '0%';
  if (percentage > 0) return `+${percentage.toFixed(1)}%`;
  return `${percentage.toFixed(1)}%`;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'DA'): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Get revenue status based on percentage
 */
export function getRevenueStatus(percentage: number): {
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'loss';
  color: string;
  label: string;
} {
  if (percentage < 0) {
    return {
      status: 'loss',
      color: 'text-red-600',
      label: 'Loss'
    };
  }
  
  if (percentage < 10) {
    return {
      status: 'poor',
      color: 'text-orange-600',
      label: 'Poor'
    };
  }
  
  if (percentage < 25) {
    return {
      status: 'fair',
      color: 'text-yellow-600',
      label: 'Fair'
    };
  }
  
  if (percentage < 50) {
    return {
      status: 'good',
      color: 'text-green-600',
      label: 'Good'
    };
  }
  
  return {
    status: 'excellent',
    color: 'text-green-700',
    label: 'Excellent'
  };
}

/**
 * Calculate optimal pricing for target revenue percentage
 */
export function calculateOptimalPricing(
  purchasePrice: number,
  targetRevenuePercentage: number
): number {
  return purchasePrice * (1 + targetRevenuePercentage / 100);
}

/**
 * Calculate break-even quantity for fixed costs
 */
export function calculateBreakEvenQuantity(
  purchasePrice: number,
  sellingPrice: number,
  fixedCosts: number
): number {
  const profitPerUnit = sellingPrice - purchasePrice;
  if (profitPerUnit <= 0) return Infinity;
  return Math.ceil(fixedCosts / profitPerUnit);
}
