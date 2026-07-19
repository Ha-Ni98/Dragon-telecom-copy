import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductNameGeneration } from '@/hooks/use-product-name-generation';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Tag, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Loader2,
  Lightbulb,
  Wand2
} from 'lucide-react';

interface ProductNameGeneratorProps {
  family: string;
  brand: string;
  model: string;
  value: string;
  onChange: (name: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Product name generator component with auto-generation and suggestions
 */
export function ProductNameGenerator({ 
  family,
  brand,
  model,
  value, 
  onChange, 
  onValidationChange,
  disabled = false,
  className = ""
}: ProductNameGeneratorProps) {
  const { t } = useTranslation();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  
  const {
    isGenerating,
    generateProductName,
    validateProductName,
    canGenerateName,
    getNameSuggestions,
    generationState
  } = useProductNameGeneration();

  // Auto-generate when family, brand, and model are all filled
  useEffect(() => {
    if (canGenerateName({ family, brand, model }) && !value) {
      handleAutoGenerate();
    }
  }, [family, brand, model, value, canGenerateName]);

  // Handle name generation
  const handleGenerate = async () => {
    try {
      const name = await generateProductName({ family, brand, model });
      if (name) {
        onChange(name);
        setValidationError(null);
        onValidationChange?.(true);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Name generation failed:', error);
    }
  };

  // Handle auto-generation
  const handleAutoGenerate = async () => {
    if (canGenerateName({ family, brand, model })) {
      await handleGenerate();
    }
  };

  // Handle manual name input
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    if (newValue.trim().length > 0) {
      const validation = validateProductName(newValue);
      if (validation.isValid) {
        setValidationError(null);
        onValidationChange?.(true);
      } else {
        setValidationError(validation.error || null);
        onValidationChange?.(false);
      }
    } else {
      setValidationError(null);
      onValidationChange?.(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    onChange(suggestion);
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);
    setValidationError(null);
    onValidationChange?.(true);
  };

  // Get suggestions
  const suggestions = getNameSuggestions({ family, brand, model });
  const canGenerate = canGenerateName({ family, brand, model });
  const isValid = value.trim().length > 0 && !validationError;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          {t('admin.productAdd.productName')}
        </CardTitle>
        <CardDescription>
          {t('admin.productAdd.productNameDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name Input */}
        <div className="space-y-2">
          <Label htmlFor="product-name-input">
            {t('admin.productAdd.productName')}
          </Label>
          <div className="flex gap-2">
            <Input
              id="product-name-input"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={t('admin.productAdd.productNamePlaceholder')}
              disabled={disabled || isGenerating}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={disabled || isGenerating || !canGenerate}
              className="shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {t('admin.productAdd.nameGenerate')}
            </Button>
          </div>
        </div>

        {/* Generation Status */}
        {canGenerate && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <Lightbulb className="h-3 w-3 mr-1" />
              {t('admin.productAdd.autoGenerationReady')}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-xs"
            >
              {showSuggestions ? t('common.hide') : t('common.show')} {t('admin.productAdd.suggestions')}
            </Button>
          </div>
        )}

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('admin.productAdd.suggestions')}
            </Label>
            <div className="grid gap-2">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  type="button"
                  variant={selectedSuggestion === suggestion ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="justify-start text-left h-auto p-2"
                >
                  <span className="truncate">{suggestion}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Name Preview */}
        {value && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('admin.productAdd.namePreview')}
            </Label>
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-lg font-medium">
                {value}
              </span>
            </div>
          </div>
        )}

        {/* Validation Status */}
        {value && (
          <div className="space-y-2">
            {isValid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <Check className="h-3 w-3 mr-1" />
                {t('admin.productAdd.nameValid')}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                {t('admin.productAdd.nameInvalid')}
              </Badge>
            )}
          </div>
        )}

        {/* Error Display */}
        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {validationError}
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <div className="text-sm text-muted-foreground">
          <p>{t('admin.productAdd.nameHelp')}</p>
          <ul className="mt-2 space-y-1">
            <li>• {t('admin.productAdd.nameRequirement1')}</li>
            <li>• {t('admin.productAdd.nameRequirement2')}</li>
            <li>• {t('admin.productAdd.nameRequirement3')}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
