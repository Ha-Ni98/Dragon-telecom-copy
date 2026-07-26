import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ShieldCheck } from "lucide-react";
import type { RoleDto, PageDto } from "@dragon-telecom/contract";
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleFormValues,
  type UpdateRoleFormValues,
} from "@/pages/admin/users/components/role.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleDto | null;
  pages: PageDto[];
  onSaveCreate: (values: CreateRoleFormValues, pageKeys: string[]) => void;
  onSaveUpdate: (values: UpdateRoleFormValues, pageKeys: string[]) => void;
  isSaving?: boolean;
}

function groupPagesByGroup(pages: PageDto[]): Map<string, PageDto[]> {
  const byGroup = new Map<string, PageDto[]>();
  for (const page of pages) {
    const list = byGroup.get(page.group) ?? [];
    list.push(page);
    byGroup.set(page.group, list);
  }
  return byGroup;
}

interface PermissionMatrixProps {
  pages: PageDto[];
  pageKeys: string[];
  onChange: (pageKeys: string[]) => void;
  disabled?: boolean;
}

// ADM-16 — grouped permission matrix (pages grouped by PageDto.group, select-all per group).
// Extracted so both the create and update forms (two separate RHF instances, kept apart to
// avoid a union-typed `Control`) can share the same matrix UI.
function PermissionMatrix({ pages, pageKeys, onChange, disabled = false }: PermissionMatrixProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupPagesByGroup(pages), [pages]);

  const toggleGroup = (groupPages: PageDto[], checked: boolean) => {
    const groupKeys = groupPages.map((p) => p.key);
    onChange(
      checked
        ? Array.from(new Set([...pageKeys, ...groupKeys]))
        : pageKeys.filter((k) => !groupKeys.includes(k)),
    );
  };
  const togglePage = (key: string, checked: boolean) => {
    onChange(checked ? [...pageKeys, key] : pageKeys.filter((k) => k !== key));
  };

  return (
    <div className="space-y-3">
      {/* Plain `Label`, not `FormLabel` — `pageKeys` is local component state (not an RHF
          field on either the create or update schema), so there is no `<FormField>` context
          for `FormLabel`'s `useFormField()` to read (Sprint 7 fix — this threw on every render
          before the matrix's own live-state wiring was ever actually exercised). */}
      <Label>{t("admin.users.roleForm.pages")}</Label>
      {Array.from(groups.entries()).map(([group, groupPages]) => {
        const allChecked = groupPages.every((p) => pageKeys.includes(p.key));
        return (
          <div key={group} className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => toggleGroup(groupPages, !!checked)}
                disabled={disabled}
              />
              {group} — {t("admin.users.roleForm.selectAllInGroup")}
            </label>
            <div className="ml-6 space-y-1">
              {groupPages.map((page) => (
                <label key={page.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={pageKeys.includes(page.key)}
                    onCheckedChange={(checked) => togglePage(page.key, !!checked)}
                    disabled={disabled}
                  />
                  {page.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ADM-16 — dumb (owns only local form state); Sprint 7 wires
// `useCreateRole`/`useUpdateRole`/`useSetRolePages`. `onSaveCreate` now also carries the locally
// collected `pageKeys` (Sprint 7 fix — the create-mode submit used to call `onSaveCreate(values)`
// only, silently discarding the permission matrix the admin had just checked).
export function RoleDialog({
  open,
  onOpenChange,
  role,
  pages,
  onSaveCreate,
  onSaveUpdate,
  isSaving = false,
}: RoleDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!role;
  const [pageKeys, setPageKeys] = useState<string[]>(role?.pageKeys ?? []);

  const createForm = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema(t)),
    defaultValues: { code: "", name: "", description: "" },
  });
  const updateForm = useForm<UpdateRoleFormValues>({
    resolver: zodResolver(updateRoleSchema(t)),
    values: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      isEnabled: role?.isEnabled ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {isEditMode ? role?.name : t("admin.users.addRole")}
          </DialogTitle>
        </DialogHeader>

        {isEditMode ? (
          <Form {...updateForm}>
            <form
              onSubmit={updateForm.handleSubmit((values) => onSaveUpdate(values, pageKeys))}
              className="space-y-4"
            >
              <FormField
                control={updateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.roleForm.name")}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.roleForm.description")}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{t("common.status.enabled")}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSaving}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <PermissionMatrix
                pages={pages}
                pageKeys={pageKeys}
                onChange={setPageKeys}
                disabled={isSaving}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit((values) => onSaveCreate(values, pageKeys))}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.roleForm.code")}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.roleForm.name")}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.roleForm.description")}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <PermissionMatrix
                pages={pages}
                pageKeys={pageKeys}
                onChange={setPageKeys}
                disabled={isSaving}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
