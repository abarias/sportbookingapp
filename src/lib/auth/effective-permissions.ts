import { isPermissionKey, type PermissionKey } from "@/lib/auth/permissions";

export type PermissionSourceRow = {
  role: {
    id: string;
    name: string;
    isActive: boolean;
    permissions: Array<{ permission: { key: string } }>;
  };
};

export function resolvePermissionSources(assignments: PermissionSourceRow[]) {
  const permissions = new Set<PermissionKey>();
  const sources = new Map<PermissionKey, Array<{ roleId: string; roleName: string }>>();

  for (const assignment of assignments) {
    if (!assignment.role.isActive) continue;
    for (const entry of assignment.role.permissions) {
      if (!isPermissionKey(entry.permission.key)) continue;
      permissions.add(entry.permission.key);
      const current = sources.get(entry.permission.key) ?? [];
      current.push({ roleId: assignment.role.id, roleName: assignment.role.name });
      sources.set(entry.permission.key, current);
    }
  }

  return { permissions, sources };
}

