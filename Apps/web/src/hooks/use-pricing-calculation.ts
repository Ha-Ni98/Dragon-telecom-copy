import { useState, useCallback, useMemo } from "react";
import { PricingCalculationResult } from "@/types/draft-types/admin-product-add.types";
import { ClientCategory } from "@/types/draft-types/admin-product-add.types";

/**
 * Pricing calculation options interface
 */
interface PricingCalculationOptions {
  unitPrice: number;
  quantity: number;
  categoryPrices: Record<number, number>;
  categories: ClientCategory[];
}

/**
 * Pricing calculation state interface
 */
interface PricingCalculationState {
  calculation: PricingCalculationResult;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Custom hook for pricing calculations
 */
export function usePricingCalculation() {
  const [state, setState] = useState<PricingCalculationState>({
    calculation: {
      totalRevenue: 0,
      categoryBreakdown: {},
      averagePrice: 0,
      isValid: true,
      errors: []
    },
    isValid: true,
    errors: [],
    warnings: []
  });

  /**
   * Calculate pricing based on inputs
   */
  const calculatePricing = useCallback((options: PricingCalculationOptions): PricingCalculationResult => {
    const { unitPrice, quantity, categoryPrices, categories } = options;
    const errors: string[] = [];
    const warnings: string[] = [];
    const categoryBreakdown: Record<number, number> = {};
    let totalRevenue = 0;
    let validPrices = 0;

    // Validate unit price
    if (quantity > 0 && unitPrice <= 0) {
      errors.push("Unit price is required when quantity is greater than 0");
    }

    // Validate unit price range
    if (unitPrice > 0 && unitPrice < 0.01) {
      errors.push("Unit price must be at least 0.01");
    }

    if (unitPrice > 100000) {
      warnings.push("Unit price is very high (>100,000 DZD)");
    }

    // Calculate for each category
    categories.forEach(category => {
      const price = categoryPrices[category.idCategory] || 0;
      categoryBreakdown[category.idCategory] = price;
      
      if (price > 0) {
        totalRevenue += price * quantity;
        validPrices++;
        
        // Check for pricing anomalies
        if (unitPrice > 0) {
          const priceRatio = price / unitPrice;
          if (priceRatio < 0.5) {
            warnings.push(`${category.categoryName} price is less than 50% of unit price`);
          }
          if (priceRatio > 2) {
            warnings.push(`${category.categoryName} price is more than 200% of unit price`);
          }
        }
      } else if (quantity > 0) {
        errors.push(`Price for ${category.categoryName} is required when quantity is greater than 0`);
      }
    });

    // Calculate average price
    const averagePrice = validPrices > 0 ? totalRevenue / (validPrices * quantity) : 0;

    // Additional validations
    if (quantity > 0 && validPrices === 0) {
      errors.push("At least one category price is required when quantity is greater than 0");
    }

    if (totalRevenue > 0 && totalRevenue < 100) {
      warnings.push("Total revenue is very low (<100 DZD)");
    }

    if (totalRevenue > 1000000) {
      warnings.push("Total revenue is very high (>1,000,000 DZD)");
    }

    const result: PricingCalculationResult = {
      totalRevenue,
      categoryBreakdown,
      averagePrice,
      isValid: errors.length === 0,
      errors
    };

    setState({
      calculation: result,
      isValid: errors.length === 0,
      errors,
      warnings
    });

    return result;
  }, []);

  /**
   * Auto-calculate category prices based on unit price
   */
  const autoCalculatePrices = useCallback((unitPrice: number, categories: ClientCategory[]): Record<number, number> => {
    const prices: Record<number, number> = {};

    categories.forEach(category => {
      let multiplier = 1;
      
      // Apply different multipliers based on category
      switch (category.categoryName.toLowerCase()) {
        case 'premium':
          multiplier = 0.9; // 10% discount
          break;
        case 'vip':
          multiplier = 0.8; // 20% discount
          break;
        case 'wholesale':
          multiplier = 0.7; // 30% discount
          break;
        case 'standard':
          multiplier = 1; // No discount
          break;
        case 'basic':
          multiplier = 1.1; // 10% markup
          break;
        default:
          multiplier = 1;
      }
      
      prices[category.idCategory] = Math.round(unitPrice * multiplier * 100) / 100; // Round to 2 decimal places
    });

    return prices;
  }, []);

  /**
   * Validate pricing consistency
   */
  const validatePricingConsistency = useCallback((options: PricingCalculationOptions): string[] => {
    const { unitPrice, categoryPrices, categories } = options;
    const warnings: string[] = [];

    if (unitPrice <= 0) return warnings;

    categories.forEach(category => {
      const price = categoryPrices[category.idCategory] || 0;
      if (price > 0) {
        const ratio = price / unitPrice;
        
        if (ratio < 0.3) {
          warnings.push(`${category.categoryName} price is very low compared to unit price (${Math.round(ratio * 100)}%)`);
        }
        
        if (ratio > 3) {
          warnings.push(`${category.categoryName} price is very high compared to unit price (${Math.round(ratio * 100)}%)`);
        }
      }
    });

    return warnings;
  }, []);

  /**
   * Get pricing recommendations
   */
  const getPricingRecommendations = useCallback((unitPrice: number, categories: ClientCategory[]): Record<string, string> => {
    const recommendations: Record<string, string> = {};

    categories.forEach(category => {
      let recommendation = "";
      
      switch (category.categoryName.toLowerCase()) {
        case 'premium':
          recommendation = `Consider 10-15% discount (${Math.round(unitPrice * 0.85)} DZD)`;
          break;
        case 'vip':
          recommendation = `Consider 20-25% discount (${Math.round(unitPrice * 0.75)} DZD)`;
          break;
        case 'wholesale':
          recommendation = `Consider 30-40% discount (${Math.round(unitPrice * 0.65)} DZD)`;
          break;
        case 'standard':
          recommendation = `Use unit price (${unitPrice} DZD)`;
          break;
        case 'basic':
          recommendation = `Consider 5-10% markup (${Math.round(unitPrice * 1.05)} DZD)`;
          break;
        default:
          recommendation = `Use unit price as reference (${unitPrice} DZD)`;
      }
      
      recommendations[category.categoryName] = recommendation;
    });

    return recommendations;
  }, []);

  /**
   * Format currency
   */
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  /**
   * Get pricing statistics
   */
  const getPricingStats = useCallback((calculation: PricingCalculationResult) => {
    const categoryCount = Object.keys(calculation.categoryBreakdown).length;
    const validPrices = Object.values(calculation.categoryBreakdown).filter(price => price > 0).length;
    const priceRange = Object.values(calculation.categoryBreakdown).filter(price => price > 0);
    const minPrice = priceRange.length > 0 ? Math.min(...priceRange) : 0;
    const maxPrice = priceRange.length > 0 ? Math.max(...priceRange) : 0;

    return {
      categoryCount,
      validPrices,
      priceRange: maxPrice - minPrice,
      minPrice,
      maxPrice,
      averagePrice: calculation.averagePrice,
      totalRevenue: calculation.totalRevenue
    };
  }, []);

  /**
   * Reset calculation state
   */
  const reset = useCallback(() => {
    setState({
      calculation: {
        totalRevenue: 0,
        categoryBreakdown: {},
        averagePrice: 0,
        isValid: true,
        errors: []
      },
      isValid: true,
      errors: [],
      warnings: []
    });
  }, []);

  // Memoized values
  const stats = useMemo(() => getPricingStats(state.calculation), [state.calculation, getPricingStats]);

  return {
    // State
    ...state,
    stats,
    
    // Actions
    calculatePricing,
    autoCalculatePrices,
    validatePricingConsistency,
    getPricingRecommendations,
    reset,
    
    // Utilities
    formatCurrency,
    getPricingStats
  };
}
