import { z } from 'zod';

// VALIDATE_PHONE's request body has no named schema in the spec — inferred from the route's
// own input (a bare phone lookup, re-run server-side inside register — spec BL#1).
export const ValidatePhoneSchema = z.object({
  phone: z.string(),
});
export type ValidatePhoneCommand = z.infer<typeof ValidatePhoneSchema>;

export const RegisterClientSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.email().optional(),
  storeName: z.string().optional(),
  wilayaId: z.uuid(),
  communeId: z.uuid(),
});
export type RegisterClientCommand = z.infer<typeof RegisterClientSchema>;

// phone is deliberately absent — read-only per spec ("Me: phone immutable").
export const UpdateMeSchema = z.object({
  email: z.email().optional(),
  storeName: z.string().optional(),
  wilayaId: z.uuid().optional(),
  communeId: z.uuid().optional(),
  address: z.string().optional(),
});
export type UpdateMeCommand = z.infer<typeof UpdateMeSchema>;

// Fields not spelled out in the spec beyond the route note; mirrors the
// current-password + new-password pattern, min(6) matching ResetClientPasswordCommand.
export const ChangeMyPasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});
export type ChangeMyPasswordCommand = z.infer<typeof ChangeMyPasswordSchema>;

export const ApproveClientSchema = z.object({
  username: z.string(),
  password: z.string().min(8),
  categoryId: z.uuid(),
});
export type ApproveClientCommand = z.infer<typeof ApproveClientSchema>;

// Not given a field list in the spec's type block; "reason optional" from the route note.
export const RejectClientSchema = z.object({
  reason: z.string().optional(),
});
export type RejectClientCommand = z.infer<typeof RejectClientSchema>;

export const ResetClientPasswordSchema = z.object({
  newPassword: z.string().min(6),
});
export type ResetClientPasswordCommand = z.infer<typeof ResetClientPasswordSchema>;

// ADMIN_UPDATE route note: "contact, isEnabled".
export const AdminUpdateClientSchema = z.object({
  email: z.email().optional(),
  storeName: z.string().optional(),
  address: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type AdminUpdateClientCommand = z.infer<typeof AdminUpdateClientSchema>;

export const CreatePosClientSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  categoryId: z.uuid().optional(),
  initialCredit: z.number().optional(),
});
export type CreatePosClientCommand = z.infer<typeof CreatePosClientSchema>;

// No field list given for the ADMIN PATCH; initialCredit is create-only (credit is
// ledger-derived thereafter), isEnabled follows the universal isEnabled-PATCH convention.
export const UpdatePosClientSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  categoryId: z.uuid().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdatePosClientCommand = z.infer<typeof UpdatePosClientSchema>;

export const AddCartItemSchema = z.object({
  productId: z.uuid(),
});
export type AddCartItemCommand = z.infer<typeof AddCartItemSchema>;
