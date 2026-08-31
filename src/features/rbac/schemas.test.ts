import { describe, expect, it } from "vitest";

import { adminUserRoleSchema, roleFormSchema } from "@/features/rbac/schemas";

describe("RBAC mutation schemas", () => {
  it("accepts a named role with a reviewable description", () => {
    expect(roleFormSchema.safeParse({ name: "Court Supervisor", description: "Manages daily court booking operations.", permissionKeys: ["bookings.view"], isActive: true }).success).toBe(true);
  });

  it("rejects vague or oversized role input", () => {
    expect(roleFormSchema.safeParse({ name: "X", description: "short", permissionKeys: [], isActive: true }).success).toBe(false);
    expect(roleFormSchema.safeParse({ name: "Valid role", description: "A sufficiently clear role description.", permissionKeys: Array.from({ length: 101 }, (_, index) => `permission-${index}`), isActive: true }).success).toBe(false);
  });

  it("requires a target user for role assignment", () => {
    expect(adminUserRoleSchema.safeParse({ userId: "", roleIds: ["role-1"], adminAccessActive: true }).success).toBe(false);
  });
});

