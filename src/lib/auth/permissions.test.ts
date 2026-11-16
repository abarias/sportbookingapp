import { describe, expect, it } from "vitest";

import { adminNavigationItems, visibleAdminNavigation } from "@/lib/auth/admin-navigation";
import { resolvePermissionSources } from "@/lib/auth/effective-permissions";
import {
  expandPermissionDependencies,
  isPermissionKey,
  permissionCatalog,
  permissionDependencies,
  protectedSuperAdminPermissions,
  seededRolePermissions,
  type PermissionKey
} from "@/lib/auth/permissions";

function assignment(roleId: string, roleName: string, permissions: string[], isActive = true) {
  return {
    role: {
      id: roleId,
      name: roleName,
      isActive,
      permissions: permissions.map((key) => ({ permission: { key } }))
    }
  };
}

describe("RBAC permission catalog", () => {
  it("contains unique stable permission keys", () => {
    const keys = permissionCatalog.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(isPermissionKey)).toBe(true);
  });

  it("only references known permissions in dependency rules", () => {
    for (const [permission, dependencies] of Object.entries(permissionDependencies)) {
      expect(isPermissionKey(permission)).toBe(true);
      expect(dependencies?.every(isPermissionKey)).toBe(true);
    }
  });

  it("automatically includes transitive prerequisites", () => {
    const expanded = expandPermissionDependencies(["bookings.reschedule", "payments.verify", "reports.export", "roles.manage"]);
    const expected: PermissionKey[] = [
      "availability.view",
      "bookings.view",
      "bookings.manage",
      "bookings.reschedule",
      "payments.view",
      "payments.verify",
      "reports.view",
      "reports.export",
      "roles.view",
      "roles.manage"
    ];
    for (const permission of expected) expect(expanded.has(permission)).toBe(true);
  });
});

describe("seeded role matrix", () => {
  it("gives the protected Super Admin every catalog permission", () => {
    expect(new Set(seededRolePermissions.SUPER_ADMIN)).toEqual(new Set(protectedSuperAdminPermissions));
  });

  it("keeps Receptionist access limited to front-desk work", () => {
    const permissions = new Set<PermissionKey>(seededRolePermissions.RECEPTIONIST);
    expect(permissions.has("bookings.create")).toBe(true);
    expect(permissions.has("customers.view_limited")).toBe(true);
    expect(permissions.has("customers.view_full")).toBe(false);
    expect(permissions.has("payments.verify")).toBe(false);
    expect(permissions.has("reports.view")).toBe(false);
    expect(permissions.has("pricing.manage")).toBe(false);
    expect(permissions.has("roles.manage")).toBe(false);
  });

  it("allows Booking Admin payment verification and reporting without security or pricing management", () => {
    const permissions = new Set<PermissionKey>(seededRolePermissions.BOOKING_ADMIN);
    expect(permissions.has("payments.verify")).toBe(true);
    expect(permissions.has("reports.export")).toBe(true);
    expect(permissions.has("bookings.reschedule")).toBe(true);
    expect(permissions.has("bookings.reschedule.resolve_adjustment")).toBe(true);
    expect(permissions.has("bookings.reschedule.override_adjustment")).toBe(false);
    expect(permissions.has("pricing.manage")).toBe(false);
    expect(permissions.has("roles.manage")).toBe(false);
  });

  it("does not grant paid-booking rescheduling to Receptionist or Social Media roles", () => {
    expect(seededRolePermissions.RECEPTIONIST).not.toContain("bookings.reschedule");
    expect(seededRolePermissions.SOCIAL_MEDIA).not.toContain("bookings.reschedule");
  });

  it("limits Social Media Person to facility content and photos", () => {
    expect(new Set(seededRolePermissions.SOCIAL_MEDIA)).toEqual(new Set(["facility_content.edit", "facility_photos.manage"]));
  });
});

describe("effective permission resolution", () => {
  it("unions multiple active roles and records every contributing role", () => {
    const result = resolvePermissionSources([
      assignment("role-a", "Front Desk", ["bookings.view", "availability.view"]),
      assignment("role-b", "Payment Desk", ["bookings.view", "payments.view"])
    ]);
    expect([...result.permissions]).toEqual(expect.arrayContaining(["bookings.view", "availability.view", "payments.view"]));
    expect(result.sources.get("bookings.view")?.map((source) => source.roleName)).toEqual(["Front Desk", "Payment Desk"]);
  });

  it("ignores inactive roles and unknown permissions", () => {
    const result = resolvePermissionSources([
      assignment("inactive", "Inactive", ["roles.manage"], false),
      assignment("unknown", "Unknown", ["made.up.permission"])
    ]);
    expect(result.permissions.size).toBe(0);
  });

  it("updates navigation from effective permissions without role-name checks", () => {
    const visible = visibleAdminNavigation(new Set<PermissionKey>(seededRolePermissions.SOCIAL_MEDIA));
    expect(visible.map((item) => item.key)).toEqual(["facilities"]);
    expect(adminNavigationItems.some((item) => item.key === "roles" && item.permissions.includes("roles.view"))).toBe(true);
  });
});
