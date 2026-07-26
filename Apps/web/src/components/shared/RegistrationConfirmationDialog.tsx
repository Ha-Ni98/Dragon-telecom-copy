
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import type { RegisterFormValues } from "@/pages/register/register.schema";

interface RegistrationConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  // wilayaId/communeId are uuids — not meaningful to show a user reviewing their details, so the
  // caller supplies the resolved display names instead (it already has them, from whichever
  // WilayaDto the ids were picked from).
  userData: Omit<RegisterFormValues, "wilayaId" | "communeId"> & {
    wilayaName: string;
    communeName: string;
  };
  isLoading?: boolean;
}

/**
 * Confirmation dialog component for registration form
 * Displays user data for review before final submission
 */
export function RegistrationConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  userData,
  isLoading = false,
}: RegistrationConfirmationDialogProps) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center" id="confirmation-dialog-title">
            {t('register.confirmDetails')}
          </DialogTitle>
          <DialogDescription className="text-center" id="confirmation-dialog-description">
            {t('register.reviewDetails')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('register.registrationDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Personal Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('register.firstName')}
                  </label>
                  <p className="text-sm font-medium">{userData.firstName}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('register.lastName')}
                  </label>
                  <p className="text-sm font-medium">{userData.lastName}</p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                {userData.email && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t('register.email')}
                    </label>
                    <p className="text-sm font-medium">{userData.email}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('register.phone')}
                  </label>
                  <p className="text-sm font-medium">{userData.phone}</p>
                </div>
                {userData.storeName && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t('register.storeName')}
                    </label>
                    <p className="text-sm font-medium">{userData.storeName}</p>
                  </div>
                )}
              </div>

              {/* Location Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('register.wilaya')}
                  </label>
                  <p className="text-sm font-medium">{userData.wilayaName}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('register.commune')}
                  </label>
                  <p className="text-sm font-medium">{userData.communeName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
            aria-label={t('register.cancelAria')}
          >
            {t('register.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
            aria-label={t('register.confirmAria')}
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                {t('register.confirm')}
              </>
            ) : (
              t('register.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RegistrationConfirmationDialog;
