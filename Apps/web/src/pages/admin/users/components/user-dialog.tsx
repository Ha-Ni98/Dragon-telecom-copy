import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UserType, type UserDto, type RoleDto, type PageDto } from "@dragon-telecom/contract";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from "@/pages/admin/users/components/user.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDto | null;
  roles: RoleDto[];
  pages: PageDto[];
  onSaveCreate: (values: CreateUserFormValues) => void;
  onSaveUpdate: (values: UpdateUserFormValues) => void;
  isSaving?: boolean;
  lastAdminGuardError?: string;
}

// ADM-16 — type switch (ADMIN hides the role matrix entirely; STAFF shows a role multi-select +
// a live effective-page list, `useMemo`'d from selected roleIds × RoleDto.pageKeys). Dumb (owns
// only local form state); Sprint 7 wires `useCreateUser`/`useUpdateUser`. Sprint 7 also fixed a
// real bug: the create form's `type` Select was a bare `<FormItem>`/`<FormLabel>` + `<Controller>`
// instead of `<FormField>` — `FormLabel` throws outside a `<FormField>` context (same bug class
// found in `approval-dialog.tsx` and set-04 Sprint 5's POS-client dialogs).
export function UserDialog({
  open,
  onOpenChange,
  user,
  roles,
  pages,
  onSaveCreate,
  onSaveUpdate,
  isSaving = false,
  lastAdminGuardError,
}: UserDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!user;

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema(t)),
    defaultValues: {
      username: "",
      password: "",
      type: UserType.STAFF,
      profile: { firstName: "", lastName: "" },
      roleIds: [],
    },
  });
  const updateForm = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema(t)),
    values: {
      isEnabled: user?.isEnabled ?? true,
      roleIds: user?.roles.map((r) => r.id) ?? [],
      profile: {
        firstName: user?.profile.firstName,
        lastName: user?.profile.lastName,
        phone: user?.profile.phone,
        jobTitle: user?.profile.jobTitle,
      },
    },
  });

  const watchedType = createForm.watch("type");
  const watchedCreateRoleIds = createForm.watch("roleIds") ?? [];
  const watchedUpdateRoleIds = updateForm.watch("roleIds") ?? [];
  const selectedRoleIds = isEditMode ? watchedUpdateRoleIds : watchedCreateRoleIds;
  const isStaff = isEditMode
    ? (user?.type ?? UserType.STAFF) === UserType.STAFF
    : watchedType === UserType.STAFF;

  const effectivePages = useMemo(() => {
    const selectedRoles = roles.filter((role) => selectedRoleIds.includes(role.id));
    const pageKeys = new Set(selectedRoles.flatMap((role) => role.pageKeys));
    return pages.filter((page) => pageKeys.has(page.key));
  }, [roles, selectedRoleIds, pages]);

  const toggleRole = (
    roleId: string,
    checked: boolean,
    current: string[],
    setValue: (ids: string[]) => void,
  ) => {
    setValue(checked ? [...current, roleId] : current.filter((id) => id !== roleId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? user?.username : t("admin.users.addUser")}</DialogTitle>
        </DialogHeader>

        {lastAdminGuardError && (
          <Alert variant="destructive">
            <AlertDescription>{lastAdminGuardError}</AlertDescription>
          </Alert>
        )}

        {isEditMode ? (
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(onSaveUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="profile.firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.users.form.firstName")}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="profile.lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.users.form.lastName")}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={updateForm.control}
                name="profile.jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.jobTitle")}</FormLabel>
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

              {isStaff && (
                <div className="space-y-2">
                  {/* Plain `Label`, not `FormLabel` — roleIds is set imperatively via
                      `setValue`, so this section header sits outside any `<FormField>` render
                      prop (Sprint 7 fix — `FormLabel` throws outside that context). */}
                  <Label>{t("admin.users.form.roles")}</Label>
                  <div className="space-y-2 rounded-lg border p-3">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={watchedUpdateRoleIds.includes(role.id)}
                          onCheckedChange={(checked) =>
                            toggleRole(role.id, !!checked, watchedUpdateRoleIds, (ids) =>
                              updateForm.setValue("roleIds", ids),
                            )
                          }
                          disabled={isSaving}
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.users.form.effectivePages")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {effectivePages.map((page) => (
                        <Badge key={page.key} variant="secondary">
                          {page.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
            <form onSubmit={createForm.handleSubmit(onSaveCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.username")}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.type")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UserType.ADMIN}>
                            {t("admin.users.table.type.admin")}
                          </SelectItem>
                          <SelectItem value={UserType.STAFF}>
                            {t("admin.users.table.type.staff")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="profile.firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.users.form.firstName")}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="profile.lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.users.form.lastName")}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isStaff && (
                <div className="space-y-2">
                  {/* Plain `Label`, not `FormLabel` — roleIds is set imperatively via
                      `setValue`, so this section header sits outside any `<FormField>` render
                      prop (Sprint 7 fix — `FormLabel` throws outside that context). */}
                  <Label>{t("admin.users.form.roles")}</Label>
                  <div className="space-y-2 rounded-lg border p-3">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={watchedCreateRoleIds.includes(role.id)}
                          onCheckedChange={(checked) =>
                            toggleRole(role.id, !!checked, watchedCreateRoleIds, (ids) =>
                              createForm.setValue("roleIds", ids),
                            )
                          }
                          disabled={isSaving}
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                  {createForm.formState.errors.roleIds && (
                    <p className="text-sm text-destructive">
                      {createForm.formState.errors.roleIds.message}
                    </p>
                  )}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.users.form.effectivePages")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {effectivePages.map((page) => (
                        <Badge key={page.key} variant="secondary">
                          {page.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
