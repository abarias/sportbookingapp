"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import { blockedScheduleSchema, facilityUpdateSchema } from "@/features/admin/schemas";
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
  return parsed;
}

function parseAmountMinor(value: FormDataEntryValue | null) {
  const amount = Number.parseFloat(String(value ?? ""));
  return Math.round(amount * 100);
}

export type FacilityActionState = {
  success?: string;
  message?: string;
  fieldErrors?: Partial<Record<"name" | "description" | "slotIntervalMinutes" | "amount" | "minimumMinutes" | "imageUrls" | "operatingHours", string>>;
};

export type BlockScheduleActionState = {
  success?: string;
  message?: string;
  fieldErrors?: Partial<Record<"title" | "reason" | "startDate" | "endDate" | "startTime" | "endTime", string>>;
};

export type DeleteBlockScheduleActionState = {
  success?: string;
  error?: string;
};

const deleteBlockScheduleSchema = z.object({
  blockId: z.string().min(1, "Blocked schedule is required.")
});

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

export async function updateFacilityAction(
  _prevState: FacilityActionState,
  formData: FormData
): Promise<FacilityActionState> {
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

  const parsed = facilityUpdateSchema.safeParse({
    facilityId,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    isEnabled: parseBoolean(formData.get("isEnabled")),
    slotIntervalMinutes: parseMinutes(formData.get("slotIntervalMinutes")),
    amountMinor: parseAmountMinor(formData.get("amount")),
    minimumMinutes: parseMinutes(formData.get("minimumMinutes")),
    imageUrls,
    cancellationEnabledOverride: String(formData.get("cancellationEnabledOverride") ?? "inherit"),
    operatingHours: weekdays
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const operatingHourIssue = parsed.error.issues.find((issue) => issue.path[0] === "operatingHours");

    return {
      message: "Please correct the facility details and try again.",
      fieldErrors: {
        name: flattened.name?.[0],
        description: flattened.description?.[0],
        slotIntervalMinutes: flattened.slotIntervalMinutes?.[0],
        amount: flattened.amountMinor?.[0],
        minimumMinutes: flattened.minimumMinutes?.[0],
        imageUrls: flattened.imageUrls?.[0],
        operatingHours: operatingHourIssue?.message
      }
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.facility.update({
      where: { id: parsed.data.facilityId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        isEnabled: parsed.data.isEnabled,
        slotIntervalMinutes: parsed.data.slotIntervalMinutes,
        cancellationEnabledOverride: parseNullableBoolean(parsed.data.cancellationEnabledOverride),
        images: {
          deleteMany: {},
          create: parsed.data.imageUrls.map((url, index) => ({
            url,
            altText: `${parsed.data.name} image ${index + 1}`,
            sortOrder: index
          }))
        },
        operatingHours: {
          deleteMany: {},
          create: parsed.data.operatingHours
        }
      }
    });

    const activePricing = await tx.pricingRule.findFirst({
      where: { facilityId: parsed.data.facilityId, isActive: true },
      orderBy: { createdAt: "desc" }
    });

    const nextPrice = parsed.data.amountMinor;
    const nextMinimumMinutes = parsed.data.minimumMinutes;

    if (!activePricing || activePricing.amountMinor !== nextPrice || activePricing.minimumMinutes !== nextMinimumMinutes) {
      await tx.pricingRule.updateMany({
        where: { facilityId: parsed.data.facilityId, isActive: true },
        data: { isActive: false }
      });

      await tx.pricingRule.create({
        data: {
          facilityId: parsed.data.facilityId,
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

  return {
    success: "Facility details saved."
  };
}

export async function createBlockedScheduleAction(
  _prevState: BlockScheduleActionState,
  formData: FormData
): Promise<BlockScheduleActionState> {
  const session = await requireAdminSession();

  const parsed = blockedScheduleSchema.safeParse({
    facilityId: String(formData.get("facilityId") ?? ""),
    title: String(formData.get("title") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? "")
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      message: "Please correct the blocked schedule form and try again.",
      fieldErrors: {
        title: flattened.title?.[0],
        reason: flattened.reason?.[0],
        startDate: flattened.startDate?.[0],
        endDate: flattened.endDate?.[0],
        startTime: flattened.startTime?.[0],
        endTime: flattened.endTime?.[0]
      }
    };
  }

  const facility = await prisma.facility.findUnique({
    where: { id: parsed.data.facilityId },
    select: { timezone: true }
  });

  if (!facility) {
    return {
      message: "Facility not found."
    };
  }

  const startAtUtc = fromZonedTime(`${parsed.data.startDate}T${parsed.data.startTime}:00`, facility.timezone);
  const endAtUtc = fromZonedTime(`${parsed.data.endDate}T${parsed.data.endTime}:00`, facility.timezone);

  await prisma.blockedSchedule.create({
    data: {
      facilityId: parsed.data.facilityId,
      title: parsed.data.title,
      reason: parsed.data.reason || null,
      startAtUtc,
      endAtUtc,
      createdByUserId: session.user.id
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");

  return {
    success: "Blocked schedule created."
  };
}

export async function deleteBlockedScheduleAction(
  _prevState: DeleteBlockScheduleActionState,
  formData: FormData
): Promise<DeleteBlockScheduleActionState> {
  await requireAdminSession();

  const parsed = deleteBlockScheduleSchema.safeParse({
    blockId: String(formData.get("blockId") ?? "")
  });

  if (!parsed.success) {
    return {
      error: "Blocked schedule could not be deleted."
    };
  }

  await prisma.blockedSchedule.delete({
    where: { id: parsed.data.blockId }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");

  return {
    success: "Blocked schedule deleted."
  };
}
