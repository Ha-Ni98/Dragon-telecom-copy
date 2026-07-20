import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import {
  quickAddPosClientSchema,
  type QuickAddPosClientFormValues,
} from "@/pages/staff/pos/quick-add-pos-client.schema";

interface QuickAddPosClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: QuickAddPosClientFormValues) => void;
  isSubmitting?: boolean;
}

// Dumb (owns only local form state, no hooks) — Sprint 7 wires useQuickCreatePosClient()
// and passes it in as onSubmit/isSubmitting (mirrors ProductOrderModal's established
// onSubmit/isSubmitting convention, not owning the mutation itself).
export function QuickAddPosClientDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: QuickAddPosClientDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuickAddPosClientFormValues>({
    resolver: zodResolver(quickAddPosClientSchema(t)),
    defaultValues: { name: "", phone: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.pos.quickAddClient.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="quick-add-name">{t("staff.pos.quickAddClient.nameLabel")}</Label>
            <Input id="quick-add-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="quick-add-phone">{t("staff.pos.quickAddClient.phoneLabel")}</Label>
            <Input id="quick-add-phone" {...register("phone")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.pos.quickAddClient.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
