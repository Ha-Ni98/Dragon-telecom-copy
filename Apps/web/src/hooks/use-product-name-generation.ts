import { useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';

interface ProductNameGenerationProps {
  family: string;
  brand: string;
  model: string;
}

// No admin-product-add service exists (dead scaffolding reference — Sub-01 Sprint 1
// finding); this is the same "Family Brand Model" convention getNameSuggestions uses below.
function buildProductName(family: string, brand: string, model: string): string {
  return `${family} ${brand} ${model}`;
}

/**
 * Hook for managing product name generation functionality
 */
export function useProductNameGeneration() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate product name function
  const generateProductName = useCallback(async (props: ProductNameGenerationProps): Promise<string | null> => {
    const { family, brand, model } = props;
    
    // Validate inputs
    if (!family || !brand || !model) {
      toast({
        title: t('admin.productAdd.validation.requiredFields'),
        description: t('admin.productAdd.validation.familyBrandModelRequired'),
        variant: 'destructive',
      });
      return null;
    }

    setIsGenerating(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const productName = buildProductName(family, brand, model);
      
      toast({
        title: t('admin.productAdd.nameGenerated'),
        description: `Generated name: ${productName}`,
      });
      
      return productName;
    } catch (error) {
      console.error('Product name generation failed:', error);
      toast({
        title: t('admin.productAdd.nameGenerationError'),
        description: error instanceof Error ? error.message : t('common.unexpectedError'),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [toast, t]);

  // Validate product name
  const validateProductName = useCallback((name: string): { isValid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
      return {
        isValid: false,
        error: t('admin.productAdd.validation.productNameRequired')
      };
    }

    if (name.trim().length < 3) {
      return {
        isValid: false,
        error: t('admin.productAdd.validation.productNameMinLength')
      };
    }

    if (name.trim().length > 100) {
      return {
        isValid: false,
        error: t('admin.productAdd.validation.productNameMaxLength')
      };
    }

    // Check for valid characters (letters, numbers, spaces, hyphens, parentheses)
    if (!/^[a-zA-Z0-9\s\-\(\)]+$/.test(name.trim())) {
      return {
        isValid: false,
        error: t('admin.productAdd.validation.productNameInvalidCharacters')
      };
    }

    return { isValid: true };
  }, [t]);

  // Check if name generation is possible
  const canGenerateName = useCallback((props: ProductNameGenerationProps): boolean => {
    const { family, brand, model } = props;
    return !!(family && brand && model && 
              family.trim().length > 0 && 
              brand.trim().length > 0 && 
              model.trim().length > 0);
  }, []);

  // Get name generation suggestions
  const getNameSuggestions = useCallback((props: ProductNameGenerationProps): string[] => {
    const { family, brand, model } = props;
    
    if (!canGenerateName(props)) {
      return [];
    }

    const suggestions: string[] = [];
    
    // Primary suggestion: Family Brand Model
    suggestions.push(`${family} ${brand} ${model}`);
    
    // Alternative suggestions
    suggestions.push(`${brand} ${model} ${family}`);
    suggestions.push(`${family} ${model} ${brand}`);
    suggestions.push(`${brand} ${family} ${model}`);
    
    // Remove duplicates and return
    return [...new Set(suggestions)];
  }, [canGenerateName]);

  // Memoized generation state
  const generationState = useMemo(() => ({
    isGenerating,
    canGenerate: (props: ProductNameGenerationProps) => canGenerateName(props)
  }), [isGenerating, canGenerateName]);

  return {
    // State
    isGenerating,
    
    // Actions
    generateProductName,
    validateProductName,
    canGenerateName,
    getNameSuggestions,
    
    // State helpers
    generationState
  };
}
