import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { resolvePermissionSources } from "@/lib/auth/effective-permissions";
import type { PermissionKey } from "@/lib/auth/permissions";

export type AdminAuthorization = {
  session: Session;
  permissions: Set<PermissionKey>;
  sources: Map<PermissionKey, Array<{ roleId: string; roleName: string }>>;
};

export async function getCurrentAdminAuthorization(): Promise<AdminAuthorization | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      adminAccessActive: true,
      roleAssignments: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              isActive: true,
              permissions: {
                where: { permission: { isActive: true } },
                select: { permission: { select: { key: true } } }
              }
            }
          }
        }
      }
    }
  });

  if (!user || user.role !== "ADMIN" || !user.adminAccessActive) return null;
  return { session, ...resolvePermissionSources(user.roleAssignments) };
}

export async function requirePermission(permission: PermissionKey) {
  const authorization = await getCurrentAdminAuthorization();
  if (!authorization) redirect("/login?callbackUrl=/admin&reason=session-expired");
  if (!authorization.permissions.has(permission)) redirect("/forbidden");
  return authorization;
}

export async function requireAnyPermission(required: readonly PermissionKey[]) {
  const authorization = await getCurrentAdminAuthorization();
  if (!authorization) redirect("/login?callbackUrl=/admin&reason=session-expired");
  if (!required.some((permission) => authorization.permissions.has(permission))) redirect("/forbidden");
  return authorization;
}

export async function requireAllPermissions(required: readonly PermissionKey[]) {
  const authorization = await getCurrentAdminAuthorization();
  if (!authorization) redirect("/login?callbackUrl=/admin&reason=session-expired");
  if (!required.every((permission) => authorization.permissions.has(permission))) redirect("/forbidden");
  return authorization;
}

export function hasPermission(authorization: Pick<AdminAuthorization, "permissions">, permission: PermissionKey) {
  return authorization.permissions.has(permission);
}
