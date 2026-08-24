import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); })
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { getCurrentAdminAuthorization, requirePermission } from "@/lib/auth/authorization";

const session = { user: { id: "admin-1", role: "ADMIN", name: "Admin", email: "admin@example.com" }, expires: "2099-01-01" };

describe("central authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(session);
  });

  it("denies ambiguous or inactive administrative access", async () => {
    mocks.findUnique.mockResolvedValue({ role: "ADMIN", adminAccessActive: false, roleAssignments: [] });
    await expect(getCurrentAdminAuthorization()).resolves.toBeNull();
  });

  it("denies a missing permission even for an authenticated legacy ADMIN", async () => {
    mocks.findUnique.mockResolvedValue({
      role: "ADMIN",
      adminAccessActive: true,
      roleAssignments: [{ role: { id: "reception", name: "Receptionist", isActive: true, permissions: [{ permission: { key: "bookings.view" } }] } }]
    });
    await expect(requirePermission("pricing.manage")).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("allows a permission contributed by any active assigned role", async () => {
    mocks.findUnique.mockResolvedValue({
      role: "ADMIN",
      adminAccessActive: true,
      roleAssignments: [
        { role: { id: "inactive", name: "Inactive", isActive: false, permissions: [{ permission: { key: "roles.manage" } }] } },
        { role: { id: "booking", name: "Booking Admin", isActive: true, permissions: [{ permission: { key: "payments.verify" } }] } }
      ]
    });
    const authorization = await requirePermission("payments.verify");
    expect(authorization.permissions.has("payments.verify")).toBe(true);
    expect(authorization.permissions.has("roles.manage")).toBe(false);
  });
});
