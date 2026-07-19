import { z } from "zod";

// Password validation schema
export const passwordResetSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;
