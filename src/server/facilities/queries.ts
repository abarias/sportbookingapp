import { FacilityType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { FacilityCardViewModel } from "@/features/facilities/types";

const facilityTypeLabels: Record<FacilityType, string> = {
  BASKETBALL_WHOLE: "Whole Basketball Court",
  BASKETBALL_HALF: "Half Basketball Court",
  PICKLEBALL: "Pickleball Court",
  BADMINTON: "Badminton Court",
  OTHER: "Other Facility"
};

export async function getFacilityCards(): Promise<FacilityCardViewModel[]> {
  const facilities = await prisma.facility.findMany({
    where: { isEnabled: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      images: {
        orderBy: { sortOrder: "asc" }
      },
      pricingRules: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return facilities.map((facility) => ({
    id: facility.id,
    slug: facility.slug,
    name: facility.name,
    description: facility.description,
    type: facility.type,
    typeLabel: facilityTypeLabels[facility.type],
    images: facility.images.map((image) => ({
      url: image.url,
      alt: image.altText
    })),
    price: {
      amountMinor: facility.pricingRules[0]?.amountMinor ?? 0,
      currency: "PHP"
    }
  }));
}

export async function getFacilityBySlug(slug: string) {
  return prisma.facility.findUnique({
    where: { slug },
    include: {
      images: {
        orderBy: { sortOrder: "asc" }
      },
      pricingRules: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" }
      },
      operatingHours: {
        orderBy: { dayOfWeek: "asc" }
      }
    }
  });
}

export function getFacilityTypeLabel(type: FacilityType) {
  return facilityTypeLabels[type];
}
