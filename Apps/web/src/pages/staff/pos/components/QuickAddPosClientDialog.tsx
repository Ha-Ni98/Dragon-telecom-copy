import { useForm, Controller } from "react-hook-form";
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
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { useTranslation } from "@/hooks/useTranslation";
import {
  quickAddPosClientSchema,
  type QuickAddPosClientFormValues,
} from "@/pages/staff/pos/quick-add-pos-client.schema";
import { FieldError } from "@/components/shared/FieldError";

interface QuickAddPosClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryOptions: AutocompleteOption[];
  onSubmit: (values: QuickAddPosClientFormValues) => void;
  isSubmitting?: boolean;
}

// Dumb (owns only local form state, no hooks) — Sprint 7 wires useQuickCreatePosClient()
// and passes it in as onSubmit/isSubmitting (mirrors OrderPlacementSection's established
// onSubmit/isSubmitting convention, not owning the mutation itself). S6/I9 adds a category
// field, matching the admin POS-client dialog component (AutocompleteInput, no create-new since
// no onCreateNew is passed — S6/I11's shared fix).
export function QuickAddPosClientDialog({
  open,
  onOpenChange,
  categoryOptions,
  onSubmit,
  isSubmitting,
}: QuickAddPosClientDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
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
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="quick-add-phone">{t("staff.pos.quickAddClient.phoneLabel")}</Label>
            <Input id="quick-add-phone" {...register("phone")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="quick-add-category">
              {t("staff.pos.quickAddClient.categoryLabel")}
            </Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <AutocompleteInput
                  inputId="quick-add-category"
                  value={field.value ?? ""}
                  onChange={(value) => field.onChange(value === "" ? undefined : value)}
                  suggestions={categoryOptions}
                  placeholder={t("staff.pos.quickAddClient.categoryPlaceholder")}
                />
              )}
            />
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
