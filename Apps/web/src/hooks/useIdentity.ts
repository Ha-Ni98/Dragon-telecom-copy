import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  UserListQuery,
  CreateUserCommand,
  UpdateUserCommand,
  CreateRoleCommand,
  UpdateRoleCommand,
  SetRolePagesCommand,
  PagesQuery,
  CreateTechnicianCommand,
  UpdateTechnicianCommand,
} from "@dragon-telecom/contract";
import * as identityService from "@/services/identity.service";
import { qk } from "@/lib/query-keys";

// Names distinct from use-admin-settings.ts's admin-accounts slice (useAdminAccounts/
// useCreateAdminAccount/useUpdateAdminAccount/useDeleteAdminAccount, numeric ids,
// AdminSettingsService), the pre-existing Sub-01 stub surface still serving whatever page
// consumes it until Sub-03. No other identity-shaped stub hooks exist anywhere in `/src/hooks`.

export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: qk.identity.users.list(query),
    queryFn: () => identityService.listUsers(query),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: qk.identity.users.detail(id),
    queryFn: () => identityService.getUser(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateUserCommand) => identityService.createUser(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.identity.users.all() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateUserCommand }) =>
      identityService.updateUser(id, command),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.identity.users.all() });
      queryClient.invalidateQueries({ queryKey: qk.identity.users.detail(variables.id) });
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: qk.identity.roles.all(),
    queryFn: identityService.listRoles,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateRoleCommand) => identityService.createRole(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.identity.roles.all() });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateRoleCommand }) =>
      identityService.updateRole(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.identity.roles.all() });
    },
  });
}

export function useSetRolePages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: SetRolePagesCommand }) =>
      identityService.setRolePages(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.identity.roles.all() });
    },
  });
}

export function usePages(query: PagesQuery) {
  return useQuery({
    queryKey: qk.identity.pages(query),
    queryFn: () => identityService.listPages(query),
  });
}

export function useTechnicians() {
  return useQuery({
    queryKey: qk.identity.technicians.all(),
    queryFn: identityService.listTechnicians,
  });
}

export function useCreateTechnician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateTechnicianCommand) => identityService.createTechnician(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.identity.technicians.all() });
    },
  });
}

export function useUpdateTechnician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateTechnicianCommand }) =>
      identityService.updateTechnician(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.identity.technicians.all() });
    },
  });
}
