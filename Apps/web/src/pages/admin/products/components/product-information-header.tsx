import React from 'react';
import { ArrowLeft, Save, X, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

interface ProductInformationHeaderProps {
  /** Product name to display */
  productName: string;
  /** Product code bar to display */
  productCodeBar: string;
  /** Whether the page is in edit mode */
  isEditMode: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Callback when edit mode is toggled */
  onToggleEdit: () => void;
  /** Callback when save is clicked */
  onSave: () => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

/**
 * Header component for the Admin Product Information page
 * Provides navigation, edit mode toggle, and action buttons
 */
export function ProductInformationHeader({
  productName,
  productCodeBar,
  isEditMode,
  isSaving,
  onBack,
  onToggleEdit,
  onSave,
  onCancel,
}: ProductInformationHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
          aria-label={t('admin.productInfo.header.backAria')}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{productName}</h1>
          <p className="text-muted-foreground">
            {t('admin.productInfo.title')} - {productCodeBar}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isEditMode ? (
          <>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="flex items-center gap-2"
              aria-label={t('admin.productInfo.header.cancelAria')}
            >
              <X className="h-4 w-4" />
              {t('admin.productInfo.cancel')}
            </Button>
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2"
              aria-label={t('admin.productInfo.header.saveAria')}
            >
              <Save className="h-4 w-4" />
              {isSaving ? t('common.processing') : t('admin.productInfo.save')}
            </Button>
          </>
        ) : (
          <Button
            onClick={onToggleEdit}
            disabled={isSaving}
            className="flex items-center gap-2"
            aria-label={t('admin.productInfo.header.editAria')}
          >
            <Edit3 className="h-4 w-4" />
            {t('admin.productInfo.edit')}
          </Button>
        )}
      </div>
    </header>
  );
}
