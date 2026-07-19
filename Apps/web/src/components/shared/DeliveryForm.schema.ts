import { z } from "zod";

// Form validation schema
export const deliveryFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  wilaya: z.string().min(1, "Please select a wilaya"),
  commune: z.string().min(1, "Please select a commune"),
  address: z.string().optional().nullable(),
  deliveryMode: z.enum(["home", "office"], {
    error: "Please select a delivery mode"
  })
});
