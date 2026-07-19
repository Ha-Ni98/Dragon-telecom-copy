import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  X, 
  MoreVertical, 
  RefreshCw,
  Download,
  Printer,
  Share2
} from 'lucide-react';
import { SupplierWithDetails } from '@/types/draft-types';

interface SupplierInformationHeaderProps {
  supplier: SupplierWithDetails;
  supplierId: number;
  isEditMode: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onEditModeToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}

/**
 * Supplier Information Header Component
 * Provides breadcrumb navigation, supplier info, and action buttons
 */
export function SupplierInformationHeader({
  supplier,
  supplierId,
  isEditMode,
  isSaving,
  hasUnsavedChanges,
  onEditModeToggle,
  onSave,
  onCancel,
  onRefresh,
}: SupplierInformationHeaderProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleBackToSuppliers = () => {
    navigate('/admin/suppliers');
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast({
      title: t('common.info'),
      description: 'Export functionality will be implemented in a future sprint',
      variant: 'default',
    });
  };

  const handlePrint = () => {
    // TODO: Implement print functionality
    window.print();
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    if (navigator.share) {
      navigator.share({
        title: `Supplier: ${supplier.supplierName}`,
        text: `View supplier information for ${supplier.supplierName}`,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: t('common.success'),
        description: t('admin.suppliers.linkCopied'),
        variant: 'default',
      });
    }
  };

  return (
    <div className="space-y-4" role="banner" aria-label={t('admin.suppliers.informationHeaderAria')}>
      {/* Breadcrumb Navigation */}
      <nav aria-label={t('admin.suppliers.breadcrumbAria')}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={handleBackToSuppliers}
                className="cursor-pointer hover:text-primary"
                aria-label={t('common.goBackTo', { page: t('admin.suppliers.title') })}
              >
                {t('admin.suppliers.title')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator aria-hidden="true" />
            <BreadcrumbItem>
              <BreadcrumbPage aria-current="page">
                {supplier.supplierName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </nav>

      {/* Header Content */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left Side - Title and Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSuppliers}
              className="p-2"
              aria-label={t('common.goBackTo', { page: t('admin.suppliers.title') })}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" id="supplier-name">
                {supplier.supplierName}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground" aria-label={t('admin.suppliers.informationAria')}>
                <span>ID: {supplierId}</span>
                <Separator orientation="vertical" className="h-4" aria-hidden="true" />
                <span>{supplier.supplierLocation}</span>
                <Separator orientation="vertical" className="h-4" aria-hidden="true" />
                <Badge variant="secondary" aria-label={`${supplier.invoicesCount} invoices`}>
                  {supplier.invoicesCount} {t('admin.suppliers.invoices')}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Supplier Contact Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground" aria-label={t('admin.suppliers.contactInfoAria')}>
            <span>{supplier.supplierPersonName}</span>
            <span>{supplier.supplierPhone}</span>
            <span>{supplier.supplierEmail}</span>
          </div>
        </div>

        {/* Right Side - Action Buttons */}
        <div className="flex items-center gap-2" role="toolbar" aria-label={t('admin.suppliers.actionsAria')}>
          {/* Edit Mode Toggle */}
          {!isEditMode ? (
            <Button
              onClick={onEditModeToggle}
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label={t('admin.suppliers.editInfoAria')}
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              {t('common.edit')}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={onSave}
                disabled={isSaving || !hasUnsavedChanges}
                size="sm"
                className="gap-2"
                aria-label={isSaving ? t('admin.suppliers.savingChangesAria') : t('admin.suppliers.saveChangesAria')}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSaving ? t('common.saving') : t('common.save')}
              </Button>
              <Button
                onClick={onCancel}
                variant="outline"
                size="sm"
                className="gap-2"
                aria-label={t('admin.suppliers.cancelEditingAria')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {t('common.cancel')}
              </Button>
            </div>
          )}

          {/* Refresh Button */}
          <Button
            onClick={onRefresh}
            variant="outline"
            size="sm"
            className="gap-2"
            aria-label={t('admin.products.suppliers.refreshAria')}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('common.refresh')}
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label={t('common.moreActions')}>
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" role="menu" aria-label={t('common.additionalActions')}>
              <DropdownMenuItem onClick={handleExport} role="menuitem">
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('common.export')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} role="menuitem">
                <Printer className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('common.print')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare} role="menuitem">
                <Share2 className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('common.share')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">
              {t('admin.suppliers.editMode')}
            </span>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="ml-2" aria-label={t('common.unsavedChanges')}>
                {t('common.unsavedChanges')}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
