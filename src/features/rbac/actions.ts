"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { adminUserRoleSchema, roleFormSchema, roleIdSchema } from "@/features/rbac/schemas";
import { requirePermission } from "@/lib/auth/authorization";
import { expandPermissionDependencies, isPermissionKey, protectedSuperAdminPermissions } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";

export type RbacActionState = { success?: string; error?: string };

function refreshRbacPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/roles");
  revalidatePath("/admin/admin-users");
  revalidatePath("/admin/audit-logs");
}

function permissionKeysFrom(formData: FormData) {
  const requested = formData.getAll("permissionKeys").map(String).filter(isPermissionKey);
  return [...expandPermissionDependencies(requested)];
}

export async function saveRoleAction(_state: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const authorization = await requirePermission("roles.manage");
  const parsed = roleFormSchema.safeParse({
    roleId: String(formData.get("roleId") ?? "") || undefined,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    permissionKeys: permissionKeysFrom(formData),
    isActive: formData.get("isActive") === "on"
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid role details." };

  const actorUserId = authorization.session.user.id;
  const permissionKeys = parsed.data.roleId === "role_super_admin" ? protectedSuperAdminPermissions : parsed.data.permissionKeys.filter(isPermissionKey);
  const ungrantablePermission = permissionKeys.find((permission) => !authorization.permissions.has(permission));
  if (ungrantablePermission) {
    await writeAuditLog(prisma, { actorUserId, action: "role.permission_escalation_blocked", entityType: "Role", entityId: parsed.data.roleId ?? null, metadata: { permission: ungrantablePermission } });
    return { error: "You cannot grant a permission that you do not currently hold." };
  }

  try {
    const roleId = await prisma.$transaction(async (tx) => {
      const permissionRows = await tx.permission.findMany({
        where: { key: { in: [...permissionKeys] }, isActive: true },
        select: { id: true, key: true }
      });
      if (permissionRows.length !== permissionKeys.length) throw new Error("One or more permissions are unavailable.");

      if (!parsed.data.roleId) {
        const role = await tx.role.create({
          data: {
            name: parsed.data.name,
            description: parsed.data.description,
            isActive: parsed.data.isActive,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
            permissions: {
              create: permissionRows.map((permission) => ({ permissionId: permission.id, assignedByUserId: actorUserId }))
            }
          }
        });
        await writeAuditLog(tx, { actorUserId, action: "role.created", entityType: "Role", entityId: role.id, after: { name: role.name, permissionKeys } });
        return role.id;
      }

      const existing = await tx.role.findUnique({
        where: { id: parsed.data.roleId },
        include: { permissions: { include: { permission: { select: { key: true } } } } }
      });
      if (!existing) throw new Error("Role not found.");
      if (existing.isProtected) {
        await writeAuditLog(tx, { actorUserId, action: "role.protected_modification_blocked", entityType: "Role", entityId: existing.id, metadata: { requestedName: parsed.data.name } });
        throw new Error("The protected Super Admin role cannot be modified.");
      }

      await tx.role.update({
        where: { id: existing.id },
        data: { name: parsed.data.name, description: parsed.data.description, isActive: parsed.data.isActive, updatedByUserId: actorUserId }
      });
      await tx.rolePermission.deleteMany({ where: { roleId: existing.id } });
      if (permissionRows.length) {
        await tx.rolePermission.createMany({
          data: permissionRows.map((permission) => ({ roleId: existing.id, permissionId: permission.id, assignedByUserId: actorUserId }))
        });
      }
      await writeAuditLog(tx, {
        actorUserId,
        action: "role.updated",
        entityType: "Role",
        entityId: existing.id,
        before: { name: existing.name, description: existing.description, isActive: existing.isActive, permissionKeys: existing.permissions.map((item) => item.permission.key) },
        after: { name: parsed.data.name, description: parsed.data.description, isActive: parsed.data.isActive, permissionKeys }
      });
      return existing.id;
    });

    refreshRbacPages();
    return { success: `${parsed.data.roleId ? "Role updated" : "Role created"}: ${parsed.data.name}. Dependencies were included automatically. (${roleId})` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A role with that name already exists." };
    if (error instanceof Error && error.message.includes("protected Super Admin")) {
      await writeAuditLog(prisma, { actorUserId, action: "role.protected_modification_blocked", entityType: "Role", entityId: parsed.data.roleId ?? null });
    }
    return { error: error instanceof Error ? error.message : "Role could not be saved." };
  }
}

export async function cloneRoleAction(_state: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const authorization = await requirePermission("roles.manage");
  const parsed = roleIdSchema.safeParse({ roleId: String(formData.get("roleId") ?? "") });
  if (!parsed.success) return { error: "Select a role to clone." };
  const source = await prisma.role.findUnique({
    where: { id: parsed.data.roleId },
    include: { permissions: { include: { permission: { select: { key: true } } } } }
  });
  if (!source) return { error: "Role not found." };
  const ungrantablePermission = source.permissions.find((item) => !isPermissionKey(item.permission.key) || !authorization.permissions.has(item.permission.key));
  if (ungrantablePermission) {
    await writeAuditLog(prisma, { actorUserId: authorization.session.user.id, action: "role.permission_escalation_blocked", entityType: "Role", entityId: source.id, metadata: { operation: "clone" } });
    return { error: "You cannot clone a role containing permissions that you do not hold." };
  }

  const actorUserId = authorization.session.user.id;
  const baseName = `${source.name} Copy`;
  let name = baseName;
  let suffix = 2;
  while (await prisma.role.findUnique({ where: { name }, select: { id: true } })) name = `${baseName} ${suffix++}`;

  const clone = await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        name,
        description: source.description,
        isActive: true,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
        permissions: { create: source.permissions.map((item) => ({ permissionId: item.permissionId, assignedByUserId: actorUserId })) }
      }
    });
    await writeAuditLog(tx, { actorUserId, action: "role.cloned", entityType: "Role", entityId: role.id, after: { name, sourceRoleId: source.id } });
    return role;
  });
  refreshRbacPages();
  return { success: `Created ${clone.name}.` };
}

export async function deleteRoleAction(_state: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const authorization = await requirePermission("roles.manage");
  const parsed = roleIdSchema.safeParse({ roleId: String(formData.get("roleId") ?? "") });
  if (!parsed.success) return { error: "Select a role to delete." };

  try {
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id: parsed.data.roleId }, include: { _count: { select: { users: true } } } });
      if (!role) throw new Error("Role not found.");
      if (role.isSystem || role.isProtected) {
        await writeAuditLog(tx, { actorUserId: authorization.session.user.id, action: "role.protected_deletion_blocked", entityType: "Role", entityId: role.id });
        throw new Error("System roles cannot be deleted.");
      }
      if (role._count.users > 0) throw new Error("Remove all assigned users before deleting this role.");
      await writeAuditLog(tx, { actorUserId: authorization.session.user.id, action: "role.deleted", entityType: "Role", entityId: role.id, before: { name: role.name } });
      await tx.role.delete({ where: { id: role.id } });
    });
    refreshRbacPages();
    return { success: "Role deleted." };
  } catch (error) {
    if (error instanceof Error && error.message === "System roles cannot be deleted.") {
      await writeAuditLog(prisma, { actorUserId: authorization.session.user.id, action: "role.protected_deletion_blocked", entityType: "Role", entityId: parsed.data.roleId });
    }
    return { error: error instanceof Error ? error.message : "Role could not be deleted." };
  }
}

export async function saveAdminUserRolesAction(_state: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const authorization = await requirePermission("admin_users.manage");
  const parsed = adminUserRoleSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    roleIds: formData.getAll("roleIds").map(String),
    adminAccessActive: formData.get("adminAccessActive") === "on"
  });
  if (!parsed.success) return { error: "Invalid admin access configuration." };
  if (parsed.data.userId === authorization.session.user.id) {
    await writeAuditLog(prisma, { actorUserId: authorization.session.user.id, action: "admin_user.self_access_change_blocked", entityType: "User", entityId: parsed.data.userId });
    return { error: "For safety, you cannot change your own administrative access from this screen." };
  }
  if (parsed.data.adminAccessActive && parsed.data.roleIds.length === 0) return { error: "Assign at least one role before activating admin access." };

  try {
    await prisma.$transaction(async (tx) => {
      const [target, roles] = await Promise.all([
        tx.user.findUnique({
          where: { id: parsed.data.userId },
          select: { id: true, role: true, adminAccessActive: true, emailVerifiedAt: true, roleAssignments: { select: { roleId: true } } }
        }),
        tx.role.findMany({
          where: { id: { in: parsed.data.roleIds }, isActive: true },
          select: { id: true, name: true, permissions: { select: { permission: { select: { key: true } } } } }
        })
      ]);
      if (!target) throw new Error("User not found.");
      if (parsed.data.adminAccessActive && !target.emailVerifiedAt) throw new Error("Verify the user's email before activating administrative access.");
      if (roles.length !== parsed.data.roleIds.length) throw new Error("Inactive or unknown roles cannot be assigned.");
      const unassignablePermission = roles.flatMap((role) => role.permissions).find((item) => !isPermissionKey(item.permission.key) || !authorization.permissions.has(item.permission.key));
      if (unassignablePermission) throw new Error("You cannot assign a role containing permissions that you do not hold.");

      const previousRoleIds = target.roleAssignments.map((item) => item.roleId);
      const removedRoleIds = previousRoleIds.filter((roleId) => !parsed.data.roleIds.includes(roleId));
      const addedRoleIds = parsed.data.roleIds.filter((roleId) => !previousRoleIds.includes(roleId));
      if (removedRoleIds.length) await tx.userRoleAssignment.deleteMany({ where: { userId: target.id, roleId: { in: removedRoleIds } } });
      if (addedRoleIds.length) {
        await tx.userRoleAssignment.createMany({
          data: addedRoleIds.map((roleId) => ({ userId: target.id, roleId, assignedByUserId: authorization.session.user.id }))
        });
      }
      await tx.user.update({
        where: { id: target.id },
        data: { role: "ADMIN", adminAccessActive: parsed.data.adminAccessActive }
      });
      await writeAuditLog(tx, {
        actorUserId: authorization.session.user.id,
        action: "admin_user.access_updated",
        entityType: "User",
        entityId: target.id,
        before: { adminAccessActive: target.adminAccessActive, roleIds: previousRoleIds },
        after: { adminAccessActive: parsed.data.adminAccessActive, roleIds: parsed.data.roleIds },
        metadata: { addedRoleIds, removedRoleIds }
      });
    });
    refreshRbacPages();
    return { success: "Administrative access updated." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("last active Super Admin")) {
      await writeAuditLog(prisma, { actorUserId: authorization.session.user.id, action: "admin_user.last_super_admin_change_blocked", entityType: "User", entityId: parsed.data.userId });
    }
    if (error instanceof Error && error.message.includes("permissions that you do not hold")) {
      await writeAuditLog(prisma, { actorUserId: authorization.session.user.id, action: "admin_user.privilege_escalation_blocked", entityType: "User", entityId: parsed.data.userId });
    }
    return { error: error instanceof Error ? error.message : "Administrative access could not be updated." };
  }
}
