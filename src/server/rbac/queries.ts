import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { isPermissionKey, type PermissionKey } from "@/lib/auth/permissions";

export async function getRoleManagementData() {
  return Promise.all([
    prisma.role.findMany({
      orderBy: [{ isProtected: "desc" }, { name: "asc" }],
      include: {
        permissions: { include: { permission: true }, orderBy: { permission: { category: "asc" } } },
        users: { include: { user: { select: { id: true, fullName: true, email: true, adminAccessActive: true } } } },
        updatedBy: { select: { fullName: true } },
        _count: { select: { users: true, permissions: true } }
      }
    }),
    prisma.permission.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { displayName: "asc" }] })
  ]).then(([roles, permissions]) => ({ roles, permissions }));
}

export async function getAdminUserManagementData(options: { includeCustomerCandidates: boolean; page: number; pageSize: number; search?: string }) {
  const search = options.search?.trim() ?? "";
  const baseWhere: Prisma.UserWhereInput = options.includeCustomerCandidates ? {} : { OR: [{ role: "ADMIN" }, { roleAssignments: { some: {} } }] };
  const where: Prisma.UserWhereInput = search ? {
    AND: [baseWhere, { OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } }
    ] }]
  } : baseWhere;

  const [users, totalCount, roles] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { fullName: "asc" }],
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        adminAccessActive: true,
        updatedAt: true,
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: { select: { key: true, displayName: true, category: true } } } }
              }
            },
            assignedBy: { select: { fullName: true } }
          }
        }
      }
    }),
    prisma.user.count({ where }),
    prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        isProtected: true,
        permissions: { select: { permission: { select: { key: true, displayName: true, category: true } } } }
      }
    })
  ]);
  return { users, roles, totalCount };
}

export function effectivePermissionProvenance(user: Awaited<ReturnType<typeof getAdminUserManagementData>>["users"][number]) {
  const result = new Map<PermissionKey, { displayName: string; category: string; roles: string[] }>();
  for (const assignment of user.roleAssignments) {
    if (!assignment.role.isActive) continue;
    for (const item of assignment.role.permissions) {
      if (!isPermissionKey(item.permission.key)) continue;
      const current = result.get(item.permission.key) ?? { displayName: item.permission.displayName, category: item.permission.category, roles: [] };
      current.roles.push(assignment.role.name);
      result.set(item.permission.key, current);
    }
  }
  return [...result.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));
}

type AuditReferenceMaps = {
  users: Map<string, string>;
  roles: Map<string, string>;
  facilities: Map<string, string>;
  pricingRules: Map<string, string>;
  blockedSchedules: Map<string, string>;
  bookings: Map<string, string>;
  bookingReschedules: Map<string, string>;
  permissions: Map<string, string>;
};

function formatReference(key: string, value: string, references: AuditReferenceMaps) {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes("permissionkey")) return references.permissions.get(value) ?? value;
  if (normalizedKey.includes("roleid")) return references.roles.get(value) ?? value;
  if (normalizedKey.includes("userid")) return references.users.get(value) ?? value;
  if (normalizedKey.includes("facilityid")) return references.facilities.get(value) ?? value;
  if (normalizedKey.includes("pricingruleid")) return references.pricingRules.get(value) ?? value;
  if (normalizedKey.includes("blockedscheduleid")) return references.blockedSchedules.get(value) ?? value;
  if (normalizedKey.includes("bookingid")) return references.bookings.get(value) ?? value;
  if (normalizedKey.includes("rescheduleid")) return references.bookingReschedules.get(value) ?? value;
  return value;
}

function humanizeAuditValue(key: string, value: unknown, references: AuditReferenceMaps): string {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? formatReference(key, item, references) : humanizeAuditValue(key, item, references)).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value).map(([childKey, childValue]) => `${childKey}: ${humanizeAuditValue(childKey, childValue, references)}`).join("; ");
  }
  if (typeof value === "string") return formatReference(key, value, references);
  if (value === null || value === undefined) return "none";
  return String(value);
}

function auditEntityLabel(entityType: string, entityId: string | null, references: AuditReferenceMaps) {
  if (!entityId) return entityType;
  const maps: Record<string, Map<string, string> | undefined> = {
    User: references.users,
    Role: references.roles,
    Facility: references.facilities,
    PricingRule: references.pricingRules,
    BlockedSchedule: references.blockedSchedules,
    Booking: references.bookings,
    BookingReschedule: references.bookingReschedules
  };
  return `${entityType}: ${maps[entityType]?.get(entityId) ?? entityId}`;
}

function auditDetails(log: { before: unknown; after: unknown; metadata: unknown }, references: AuditReferenceMaps) {
  const sections = [
    log.before ? `Before: ${humanizeAuditValue("before", log.before, references)}` : null,
    log.after ? `After: ${humanizeAuditValue("after", log.after, references)}` : null,
    log.metadata ? `Details: ${humanizeAuditValue("metadata", log.metadata, references)}` : null
  ];
  return sections.filter(Boolean).join(" · ") || "—";
}

async function getAuditReferenceMaps(): Promise<AuditReferenceMaps> {
  const [users, roles, facilities, pricingRules, blockedSchedules, bookings, bookingReschedules, permissions] = await Promise.all([
    prisma.user.findMany({ select: { id: true, fullName: true } }),
    prisma.role.findMany({ select: { id: true, name: true } }),
    prisma.facility.findMany({ select: { id: true, name: true } }),
    prisma.pricingRule.findMany({ select: { id: true, name: true } }),
    prisma.blockedSchedule.findMany({ select: { id: true, title: true } }),
    prisma.booking.findMany({ select: { id: true, startAtUtc: true, facility: { select: { name: true } } } }),
    prisma.bookingReschedule.findMany({
      select: {
        id: true,
        originalBookingReference: true,
        originalFacility: { select: { name: true } },
        replacementFacility: { select: { name: true } }
      }
    }),
    prisma.permission.findMany({ select: { key: true, displayName: true } })
  ]);

  return {
    users: new Map(users.map((item) => [item.id, item.fullName])),
    roles: new Map(roles.map((item) => [item.id, item.name])),
    facilities: new Map(facilities.map((item) => [item.id, item.name])),
    pricingRules: new Map(pricingRules.map((item) => [item.id, item.name])),
    blockedSchedules: new Map(blockedSchedules.map((item) => [item.id, item.title])),
    bookings: new Map(bookings.map((item) => [item.id, `${item.facility.name} · ${item.startAtUtc.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`])),
    bookingReschedules: new Map(bookingReschedules.map((item) => [item.id, `${item.originalBookingReference} · ${item.originalFacility.name} → ${item.replacementFacility.name}`])),
    permissions: new Map(permissions.map((item) => [item.key, item.displayName]))
  };
}

export async function getAuditLogData(options: { page: number; pageSize: number; search?: string }) {
  const search = options.search?.trim() ?? "";
  const matchingUsers = search ? await prisma.user.findMany({
    where: { OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } }
    ] },
    select: { id: true }
  }) : [];
  const userIds = matchingUsers.map((user) => user.id);
  const where: Prisma.AuditLogWhereInput = search ? {
    OR: [
      { action: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      ...(userIds.length ? [{ actorUserId: { in: userIds } }, { entityType: "User", entityId: { in: userIds } }] : [])
    ]
  } : {};
  const [logs, totalCount, references] = await Promise.all([
    prisma.auditLog.findMany({ where, skip: (options.page - 1) * options.pageSize, take: options.pageSize, orderBy: { createdAt: "desc" }, include: { actor: { select: { fullName: true, email: true } } } }),
    prisma.auditLog.count({ where }),
    getAuditReferenceMaps()
  ]);
  return { logs: logs.map((log) => ({ ...log, targetLabel: auditEntityLabel(log.entityType, log.entityId, references), details: auditDetails(log, references) })), totalCount };
}

export async function getAdminUserAccessHistory(userId: string, options: { page: number; pageSize: number }) {
  const where = { entityType: "User", entityId: userId, action: { startsWith: "admin_user." } } as const;
  const [logs, totalCount, references] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { fullName: true } } }
    }),
    prisma.auditLog.count({ where }),
    getAuditReferenceMaps()
  ]);
  return { logs: logs.map((log) => ({ ...log, details: auditDetails(log, references) })), totalCount };
}
