import { describe, expect, it } from "vitest";

import { resolveFacilityCapabilities } from "@/features/admin/facility-permissions";
import type { PermissionKey } from "@/lib/auth/permissions";

describe("facility field authorization", () => {
  it("allows Social Media users to edit content and photos but not crafted operational or pricing fields", () => {
    const access = resolveFacilityCapabilities(new Set<PermissionKey>(["facility_content.edit", "facility_photos.manage"]));
    expect(access).toEqual({ content: true, photos: true, operations: false, pricing: false });
  });

  it("does not make facility operations imply content, photo, or pricing authority", () => {
    const access = resolveFacilityCapabilities(new Set<PermissionKey>(["facilities.manage"]));
    expect(access.operations).toBe(true);
    expect(access.content).toBe(false);
    expect(access.photos).toBe(false);
    expect(access.pricing).toBe(false);
  });
});
