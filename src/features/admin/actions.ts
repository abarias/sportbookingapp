"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";

import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function parseNullableBoolean(value: string) {
  if (value === "inherit") {
    return null;
  }

  return value === "enabled";
}

function parseMinutes(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid numeric value.");
  }

  return parsed;
}

function parseAmountMinor(value: FormDataEntryValue | null) {
  const amount = Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid price value.");
  }

  return Math.round(amount * 100);
}

export async function updateCancellationSettingAction(formData: FormData) {
  await requireAdminSession();

  await prisma.appSetting.upsert({
    where: { key: "booking.cancellationEnabled" },
    update: {
      value: parseBoolean(formData.get("enabled"))
    },
    create: {
      key: "booking.cancellationEnabled",
      value: parseBoolean(formData.get("enabled"))
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
}

export async function updateFacilityAction(formData: FormData) {
  await requireAdminSession();

  const facilityId = String(formData.get("facilityId") ?? "");
  const imageUrls = String(formData.get("imageUrls") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const weekdays = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAtMinutes: parseMinutes(formData.get(`opensAtMinutes_${dayOfWeek}`)),
    closesAtMinutes: parseMinutes(formData.get(`closesAtMinutes_${dayOfWeek}`)),
    isClosed: parseBoolean(formData.get(`isClosed_${dayOfWeek}`))
  }));

  await prisma.$transaction(async (tx) => {
    await tx.facility.update({
      where: { id: facilityId },
      data: {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        isEnabled: parseBoolean(formData.get("isEnabled")),
        slotIntervalMinutes: parseMinutes(formData.get("slotIntervalMinutes")),
        cancellationEnabledOverride: parseNullableBoolean(String(formData.get("cancellationEnabledOverride") ?? "inherit")),
        images: {
          deleteMany: {},
          create: imageUrls.map((url, index) => ({
            url,
            altText: `${String(formData.get("name") ?? "")} image ${index + 1}`,
            sortOrder: index
          }))
        },
        operatingHours: {
          deleteMany: {},
          create: weekdays
        }
      }
    });

    const activePricing = await tx.pricingRule.findFirst({
      where: { facilityId, isActive: true },
      orderBy: { createdAt: "desc" }
    });

    const nextPrice = parseAmountMinor(formData.get("amount"));
    const nextMinimumMinutes = parseMinutes(formData.get("minimumMinutes"));

    if (!activePricing || activePricing.amountMinor !== nextPrice || activePricing.minimumMinutes !== nextMinimumMinutes) {
      await tx.pricingRule.updateMany({
        where: { facilityId, isActive: true },
        data: { isActive: false }
      });

      await tx.pricingRule.create({
        data: {
          facilityId,
          currency: "PHP",
          amountMinor: nextPrice,
          billingMode: "PER_HOUR",
          minimumMinutes: nextMinimumMinutes,
          isActive: true
        }
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");
}

export async function createBlockedScheduleAction(formData: FormData) {
  const session = await requireAdminSession();

  const facilityId = String(formData.get("facilityId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");

  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: { timezone: true }
  });

  if (!facility) {
    throw new Error("Facility not found.");
  }

  const startAtUtc = fromZonedTime(`${date}T${startTime}:00`, facility.timezone);
  const endAtUtc = fromZonedTime(`${date}T${endTime}:00`, facility.timezone);

  if (startAtUtc >= endAtUtc) {
    throw new Error("Block end must be after the start time.");
  }

  await prisma.blockedSchedule.create({
    data: {
      facilityId,
      title,
      reason: reason || null,
      startAtUtc,
      endAtUtc,
      createdByUserId: session.user.id
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");
}
