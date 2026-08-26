import type { PermissionKey } from "@/lib/auth/permissions";

export const adminNavigationItems = [
  { key: "overview", href: "/admin", label: "Overview", permissions: ["bookings.view"] },
  { key: "calendar", href: "/admin/calendar", label: "Calendar", permissions: ["availability.view"] },
  { key: "walk-ins", href: "/admin/walk-ins", label: "Walk-ins", permissions: ["bookings.create"] },
  { key: "facilities", href: "/admin/facilities", label: "Facilities", permissions: ["facilities.manage", "facility_content.edit", "facility_photos.manage", "pricing.manage"] },
  { key: "pricing", href: "/admin/pricing", label: "Pricing", permissions: ["pricing.view"] },
  { key: "holidays", href: "/admin/holidays", label: "Holidays", permissions: ["holidays.manage"] },
  { key: "payments", href: "/admin/payments", label: "Payments", permissions: ["payments.view"] },
  { key: "customers", href: "/admin/customers", label: "Customers", permissions: ["customers.view_full"] },
  { key: "reports", href: "/admin/reports", label: "Reports", permissions: ["reports.view"] },
  { key: "roles", href: "/admin/roles", label: "Roles", permissions: ["roles.view"] },
  { key: "admin-users", href: "/admin/admin-users", label: "Admin Users", permissions: ["admin_users.view"] },
  { key: "audit-logs", href: "/admin/audit-logs", label: "Audit Log", permissions: ["audit_logs.view"] }
] as const satisfies readonly { key: string; href: string; label: string; permissions: readonly PermissionKey[] }[];

export type AdminNavigationKey = (typeof adminNavigationItems)[number]["key"];

export function visibleAdminNavigation(permissions: ReadonlySet<PermissionKey>) {
  return adminNavigationItems.filter((item) => item.permissions.some((permission) => permissions.has(permission)));
}
