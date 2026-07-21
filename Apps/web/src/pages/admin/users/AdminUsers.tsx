import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Users, ShieldCheck } from "lucide-react";
import { UsersTable } from "@/pages/admin/users/components/users-table";
import { UserDialog } from "@/pages/admin/users/components/user-dialog";
import { RolesTable } from "@/pages/admin/users/components/roles-table";
import { RoleDialog } from "@/pages/admin/users/components/role-dialog";
import type { UserDto, RoleDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-16 — page-local primitives assembled (Sprint 4, no data yet). Sprint 7 wires
// `useUsers`/`useRoles`/`usePages({scope:'staff'})` + the mutations.
export default function AdminUsers() {
  const { t } = useTranslation();
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);

  const openUserDialog = (user: UserDto | null) => {
    setEditingUser(user);
    setIsUserDialogOpen(true);
  };
  const openRoleDialog = (role: RoleDto | null) => {
    setEditingRole(role);
    setIsRoleDialogOpen(true);
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
          <UsersTable data={[]} isLoading={false} onEdit={openUserDialog} />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openRoleDialog(null)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("admin.users.addRole")}
            </Button>
          </div>
          <RolesTable data={[]} isLoading={false} onEdit={openRoleDialog} />
        </TabsContent>
      </Tabs>

      <UserDialog
        open={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
        user={editingUser}
        roles={[]}
        pages={[]}
        onSaveCreate={() => setIsUserDialogOpen(false)}
        onSaveUpdate={() => setIsUserDialogOpen(false)}
      />

      <RoleDialog
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        role={editingRole}
        pages={[]}
        onSaveCreate={() => setIsRoleDialogOpen(false)}
        onSaveUpdate={() => setIsRoleDialogOpen(false)}
      />
    </div>
  );
}
