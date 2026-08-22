import type { Prisma } from "@prisma/client";

import type { PriceCalculation } from "@/server/pricing/types";

export function parsePriceSnapshot(value: Prisma.JsonValue | null | undefined): PriceCalculation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.currency !== "PHP" ||
    candidate.vatTreatment !== "EXCLUSIVE" ||
    typeof candidate.amountMinor !== "number" ||
    !Array.isArray(candidate.segments)
  ) return null;
  return value as unknown as PriceCalculation;
}
