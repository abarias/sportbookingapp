import type { PermissionKey } from "@/lib/auth/permissions";

export function resolveFacilityCapabilities(permissions: ReadonlySet<PermissionKey>) {
  const operations = permissions.has("facilities.manage");
  return {
    operations,
    content: permissions.has("facility_content.edit"),
    photos: permissions.has("facility_photos.manage"),
    pricing: permissions.has("pricing.manage")
  };
}
