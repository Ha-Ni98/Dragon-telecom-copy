import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface AddSupplyButtonProps {
  productId: number;
  isEditMode: boolean;
  isSaving: boolean;
  onAddSupply: () => void;
}

export function AddSupplyButton({ isEditMode, isSaving, onAddSupply }: AddSupplyButtonProps) {
  const { t } = useTranslation();

  if (!isEditMode) {
    return null;
  }

  return (
    <Button 
      size="sm" 
      className="h-8 gap-1"
      onClick={onAddSupply}
      disabled={isSaving}
      aria-label={t('admin.productInfo.addSupply')}
    >
      <PlusCircle className="h-3.5 w-3.5" />
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
        {t('admin.productInfo.addSupply')}
      </span>
    </Button>
  );
}
