import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Users, ShieldCheck } from "lucide-react";
import { UsersTable } from "@/pages/admin/users/components/users-table";
import { UserDialog } from "@/pages/admin/users/components/user-dialog";
import { RolesTable } from "@/pages/admin/users/components/roles-table";
import { RoleDialog } from "@/pages/admin/users/components/role-dialog";
import { PageScope, type UserDto, type RoleDto } from "@dragon-telecom/contract";
import type {
  CreateUserFormValues,
  UpdateUserFormValues,
} from "@/pages/admin/users/components/user.schema";
import type {
  CreateRoleFormValues,
  UpdateRoleFormValues,
} from "@/pages/admin/users/components/role.schema";
import {
  useUsers,
  useRoles,
  usePages,
  useCreateUser,
  useUpdateUser,
  useCreateRole,
  useUpdateRole,
  useSetRolePages,
} from "@/hooks/useIdentity";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-16 — Sprint 7 wiring. Both tables are unpaginated in their Sprint-4 scaffold props
// (`RolesTable`/`UsersTable` both take a bare array, no `PaginatedResult`, and `useRoles()`
// itself returns a bare `RoleDto[]`) — fetching a single generous page rather than adding new
// pagination UI in a wiring sprint (same scope-confinement call as set-04 Sprint 6's
// supplier-invoices list).
export default function AdminUsers() {
  const { t } = useTranslation();
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [lastAdminGuardError, setLastAdminGuardError] = useState<string | undefined>();

  const usersQuery = useMemo(() => ({ page: 1, limit: 100 }), []);
  const users = useUsers(usersQuery);
  const roles = useRoles();
  const pagesQuery = useMemo(() => ({ scope: PageScope.STAFF }), []);
  const pages = usePages(pagesQuery);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const setRolePages = useSetRolePages();

  const openUserDialog = (user: UserDto | null) => {
    setLastAdminGuardError(undefined);
    setEditingUser(user);
    setIsUserDialogOpen(true);
  };
  const openRoleDialog = (role: RoleDto | null) => {
    setEditingRole(role);
    setIsRoleDialogOpen(true);
  };

  const handleSaveCreateUser = (values: CreateUserFormValues) => {
    createUser.mutate(values, {
      onSuccess: () => {
        toast.success(t("admin.users.createSuccess"));
        setIsUserDialogOpen(false);
      },
    });
  };

  const handleSaveUpdateUser = (values: UpdateUserFormValues) => {
    if (!editingUser) return;
    setLastAdminGuardError(undefined);
    updateUser.mutate(
      { id: editingUser.id, command: values },
      {
        onSuccess: () => {
          toast.success(t("admin.users.updateSuccess"));
          setIsUserDialogOpen(false);
          setEditingUser(null);
        },
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setLastAdminGuardError(t("admin.users.form.lastAdminGuard"));
          }
        },
      },
    );
  };

  const handleSaveCreateRole = (values: CreateRoleFormValues, pageKeys: string[]) => {
    createRole.mutate(values, {
      onSuccess: (role) => {
        toast.success(t("admin.users.createRoleSuccess"));
        if (pageKeys.length > 0) {
          setRolePages.mutate({ id: role.id, command: { pageKeys } });
        }
        setIsRoleDialogOpen(false);
      },
    });
  };

  const handleSaveUpdateRole = (values: UpdateRoleFormValues, pageKeys: string[]) => {
    if (!editingRole) return;
    updateRole.mutate(
      { id: editingRole.id, command: values },
      {
        onSuccess: () => {
          setRolePages.mutate({ id: editingRole.id, command: { pageKeys } });
          toast.success(t("admin.users.updateRoleSuccess"));
          setIsRoleDialogOpen(false);
          setEditingRole(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.users.title")} subtitle={t("admin.users.description")} />

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            {t("admin.users.tabs.users")}
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t("admin.users.tabs.roles")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openUserDialog(null)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("admin.users.addUser")}
            </Button>
          </div>
          <UsersTable
            data={users.data?.items ?? []}
            isLoading={users.isLoading}
            onEdit={openUserDialog}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openRoleDialog(null)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("admin.users.addRole")}
            </Button>
          </div>
          <RolesTable data={roles.data ?? []} isLoading={roles.isLoading} onEdit={openRoleDialog} />
        </TabsContent>
      </Tabs>

      <UserDialog
        key={`user-${editingUser?.id ?? "new"}`}
        open={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
        user={editingUser}
        roles={roles.data ?? []}
        pages={pages.data ?? []}
        onSaveCreate={handleSaveCreateUser}
        onSaveUpdate={handleSaveUpdateUser}
        isSaving={createUser.isPending || updateUser.isPending}
        lastAdminGuardError={lastAdminGuardError}
      />

      <RoleDialog
        key={`role-${editingRole?.id ?? "new"}`}
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        role={editingRole}
        pages={pages.data ?? []}
        onSaveCreate={handleSaveCreateRole}
        onSaveUpdate={handleSaveUpdateRole}
        isSaving={createRole.isPending || updateRole.isPending || setRolePages.isPending}
      />
    </div>
  );
}
