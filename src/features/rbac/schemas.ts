import { z } from "zod";

export const roleFormSchema = z.object({
  roleId: z.string().trim().optional(),
  name: z.string().trim().min(2, "Enter a role name.").max(80, "Role name is too long."),
  description: z.string().trim().min(10, "Describe the role's intended responsibilities.").max(500),
  permissionKeys: z.array(z.string()).max(100),
  isActive: z.boolean()
});

export const roleIdSchema = z.object({ roleId: z.string().trim().min(1) });

export const adminUserRoleSchema = z.object({
  userId: z.string().trim().min(1),
  roleIds: z.array(z.string()).max(50),
  adminAccessActive: z.boolean()
});

