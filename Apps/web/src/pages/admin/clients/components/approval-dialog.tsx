import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { CheckCircle, XCircle } from "lucide-react";
import {
  approveClientSchema,
  type ApproveClientFormValues,
} from "@/pages/admin/clients/components/approve-client.schema";
import type { AdminClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: AdminClientDto | null;
  categoryOptions: AutocompleteOption[];
  onApprove: (values: ApproveClientFormValues) => void;
  onReject: (reason?: string) => void;
  isSubmitting?: boolean;
  /** Server-side username-unique 409, surfaced inline (Sprint 7 wiring) — the mutation lives at
   * the page level, so this can't go through RHF's own `setError`. */
  usernameError?: string;
}

// ADM-12/12b — registration recap + username/password + mandatory category select +
// Approve/Reject. Dumb (owns only local form state); Sprint 7 wires
// `useApproveClient`/`useRejectClient`. The username-unique 409 can't go through RHF's own
// `setError` (the mutation lives at the page level, outside this form instance) — surfaced via
// the `usernameError` prop instead, same pattern as `UserDialog`'s `lastAdminGuardError`.
// Sprint 7 also fixed a real bug here: `categoryId` was a bare `<FormItem>`/`<FormLabel>` +
// `<Controller>` instead of `<FormField>` — `FormLabel` calls `useFormField()`, which throws
// outside a `<FormField>` context (same bug class as set-04 Sprint 5's POS-client dialogs).
export function ApprovalDialog({
  open,
  onOpenChange,
  client,
  categoryOptions,
  onApprove,
  onReject,
  isSubmitting = false,
  usernameError,
}: ApprovalDialogProps) {
  const { t } = useTranslation();
  const form = useForm<ApproveClientFormValues>({
    resolver: zodResolver(approveClientSchema(t)),
    defaultValues: { username: "", password: "", categoryId: "" },
  });

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.clients.approval.title")}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">{client.fullName}</div>
          <div className="text-muted-foreground">{client.phone}</div>
          {client.email && <div className="text-muted-foreground">{client.email}</div>}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onApprove)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.clients.approval.username")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                  {usernameError && <p className="text-sm text-destructive">{usernameError}</p>}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.clients.approval.password")}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.clients.approval.category")}</FormLabel>
                  <FormControl>
                    <AutocompleteInput
                      value={field.value}
                      onChange={field.onChange}
                      suggestions={categoryOptions}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => onReject()}
                disabled={isSubmitting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t("admin.clients.approval.reject")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("admin.clients.approval.approve")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
