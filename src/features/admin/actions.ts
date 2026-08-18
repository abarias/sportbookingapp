"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { FacilityType } from "@prisma/client";

import { adminWalkInBookingSchema, blockedScheduleSchema, facilityCreateSchema, facilityUpdateSchema, walkInCustomerSchema } from "@/features/admin/schemas";
import { hashPassword } from "@/lib/auth/password";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAdminConfirmedBooking } from "@/server/bookings/service";
import { rejectSubmittedPayment, requestPaymentAction, verifySubmittedPayment } from "@/server/payments/service";

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
  const raw = String(value ?? "").trim();

  if (/^\d{2}:\d{2}$/.test(raw)) {
    return timeToMinutes(raw);
  }

  return Number.parseInt(raw, 10);
}

function parseAmountMinor(value: FormDataEntryValue | null) {
  const amount = Number.parseFloat(String(value ?? ""));
  return Math.round(amount * 100);
}

function parseNullablePositiveInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function persistFacilityUploads(formData: FormData, slugSeed: string) {
  const files = formData
    .getAll("imageFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return [];
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "facilities");
  await mkdir(uploadDir, { recursive: true });

  const slug = slugify(slugSeed) || "facility";
  const urls: string[] = [];
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

  if (files.length > 12) {
    throw new Error("Upload a maximum of 12 facility images at a time.");
  }

  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Each facility image must be 5MB or smaller.");
    }

    if (!allowedTypes.has(file.type)) {
      throw new Error("Facility images must be JPG, PNG, WEBP, or GIF files.");
    }
  }

  for (const [index, file] of files.entries()) {
    const extensionByType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif"
    };
    const extension = extensionByType[file.type];
    const fileName = `${slug}-${Date.now()}-${index}${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(uploadDir, fileName), bytes);
    urls.push(`/uploads/facilities/${fileName}`);
  }

  return urls;
}

function buildWeekdays(formData: FormData) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAtMinutes: parseMinutes(formData.get(`opensAtMinutes_${dayOfWeek}`)),
    closesAtMinutes: parseMinutes(formData.get(`closesAtMinutes_${dayOfWeek}`)),
    isClosed: parseBoolean(formData.get(`isClosed_${dayOfWeek}`))
  }));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

export type FacilityActionState = {
  success?: string;
  message?: string;
  fieldErrors?: Partial<Record<"name" | "slug" | "type" | "description" | "amount" | "imageUrls" | "operatingHours" | "cancellationWindowHoursOverride", string>>;
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

export type WalkInBookingActionState = {
  success?: string;
  message?: string;
  customer?: {
    fullName: string;
    email: string;
    phone: string;
  };
  existingCustomer?: {
    email: string;
    phone: string | null;
  };
  fieldErrors?: Partial<Record<"fullName" | "email" | "phone" | "facilityId" | "dateKey" | "startTime" | "durationMinutes" | "paymentMethod" | "paymentReference", string>>;
};

export type PaymentReviewActionState = {
  success?: string;
  error?: string;
};

const deleteBlockScheduleSchema = z.object({
  blockId: z.string().min(1, "Blocked schedule is required.")
});

const paymentReviewSchema = z.object({
  paymentId: z.string().min(1),
  reviewNote: z.string().trim().max(500).optional()
});

export async function updateCancellationSettingAction(formData: FormData) {
  await requireAdminSession();
  const cancellationWindowHours = parseNullablePositiveInteger(formData.get("cancellationWindowHours"));

  if (cancellationWindowHours === null || !Number.isFinite(cancellationWindowHours) || cancellationWindowHours < 1) {
    throw new Error("Cancellation window must be at least 1 hour.");
  }

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: "booking.cancellationEnabled" },
      update: {
        value: parseBoolean(formData.get("enabled"))
      },
      create: {
        key: "booking.cancellationEnabled",
        value: parseBoolean(formData.get("enabled"))
      }
    }),
    prisma.appSetting.upsert({
      where: { key: "booking.cancellationWindowHours" },
      update: {
        value: cancellationWindowHours
      },
      create: {
        key: "booking.cancellationWindowHours",
        value: cancellationWindowHours
      }
    })
  ]);

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
  let uploadedUrls: string[];

  try {
    uploadedUrls = await persistFacilityUploads(formData, String(formData.get("name") ?? facilityId));
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Facility images could not be uploaded." };
  }
  const weekdays = buildWeekdays(formData);
  const cancellationWindowHoursOverride = parseNullablePositiveInteger(formData.get("cancellationWindowHoursOverride"));

  const parsed = facilityUpdateSchema.safeParse({
    facilityId,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    isEnabled: parseBoolean(formData.get("isEnabled")),
    amountMinor: parseAmountMinor(formData.get("amount")),
    imageUrls: [...imageUrls, ...uploadedUrls],
    cancellationEnabledOverride: String(formData.get("cancellationEnabledOverride") ?? "inherit"),
    operatingHours: weekdays
  });

  if (!parsed.success || (cancellationWindowHoursOverride !== null && (!Number.isFinite(cancellationWindowHoursOverride) || cancellationWindowHoursOverride < 1))) {
    const flattened = parsed.success ? undefined : parsed.error.flatten().fieldErrors;
    const operatingHourIssue = parsed.success ? undefined : parsed.error.issues.find((issue) => issue.path[0] === "operatingHours");

    return {
      message: "Please correct the facility details and try again.",
      fieldErrors: {
        name: flattened?.name?.[0],
        description: flattened?.description?.[0],
        amount: flattened?.amountMinor?.[0],
        imageUrls: flattened?.imageUrls?.[0],
        operatingHours: operatingHourIssue?.message,
        cancellationWindowHoursOverride:
          cancellationWindowHoursOverride !== null && (!Number.isFinite(cancellationWindowHoursOverride) || cancellationWindowHoursOverride < 1)
            ? "Enter a positive number of hours or leave blank."
            : undefined
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
        cancellationEnabledOverride: parseNullableBoolean(parsed.data.cancellationEnabledOverride),
        cancellationWindowHoursOverride,
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
    const nextMinimumMinutes = 60;

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

export async function createFacilityAction(
  _prevState: FacilityActionState,
  formData: FormData
): Promise<FacilityActionState> {
  await requireAdminSession();

  const imageUrls = String(formData.get("imageUrls") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  let uploadedUrls: string[];

  try {
    uploadedUrls = await persistFacilityUploads(formData, String(formData.get("slug") || formData.get("name") || "facility"));
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Facility images could not be uploaded." };
  }
  const weekdays = buildWeekdays(formData);
  const cancellationWindowHoursOverride = parseNullablePositiveInteger(formData.get("cancellationWindowHoursOverride"));

  const parsed = facilityCreateSchema.safeParse({
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    type: String(formData.get("type") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    isEnabled: parseBoolean(formData.get("isEnabled")),
    amountMinor: parseAmountMinor(formData.get("amount")),
    imageUrls: [...imageUrls, ...uploadedUrls],
    cancellationEnabledOverride: String(formData.get("cancellationEnabledOverride") ?? "inherit"),
    operatingHours: weekdays
  });

  if (!parsed.success || (cancellationWindowHoursOverride !== null && (!Number.isFinite(cancellationWindowHoursOverride) || cancellationWindowHoursOverride < 1))) {
    const flattened = parsed.success ? undefined : parsed.error.flatten().fieldErrors;
    const operatingHourIssue = parsed.success ? undefined : parsed.error.issues.find((issue) => issue.path[0] === "operatingHours");

    return {
      message: "Please correct the facility details and try again.",
      fieldErrors: {
        slug: flattened?.slug?.[0],
        type: flattened?.type?.[0],
        name: flattened?.name?.[0],
        description: flattened?.description?.[0],
        amount: flattened?.amountMinor?.[0],
        imageUrls: flattened?.imageUrls?.[0],
        operatingHours: operatingHourIssue?.message,
        cancellationWindowHoursOverride:
          cancellationWindowHoursOverride !== null && (!Number.isFinite(cancellationWindowHoursOverride) || cancellationWindowHoursOverride < 1)
            ? "Enter a positive number of hours or leave blank."
            : undefined
      }
    };
  }

  const existing = await prisma.facility.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true }
  });

  if (existing) {
    return {
      message: "A facility with this slug already exists.",
      fieldErrors: { slug: "Use a different slug." }
    };
  }

  const createdFacility = await prisma.facility.create({
    data: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type as FacilityType,
      timezone: process.env.APP_TIMEZONE ?? "Asia/Manila",
      isEnabled: parsed.data.isEnabled,
      slotIntervalMinutes: 30,
      cancellationEnabledOverride: parseNullableBoolean(parsed.data.cancellationEnabledOverride),
      cancellationWindowHoursOverride,
      images: {
        create: parsed.data.imageUrls.map((url, index) => ({
          url,
          altText: `${parsed.data.name} image ${index + 1}`,
          sortOrder: index
        }))
      },
      operatingHours: { create: parsed.data.operatingHours },
      pricingRules: {
        create: {
          currency: "PHP",
          amountMinor: parsed.data.amountMinor,
          billingMode: "PER_HOUR",
          minimumMinutes: 60,
          isActive: true
        }
      }
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");

  redirect(`/admin/facilities?facilityId=${encodeURIComponent(createdFacility.id)}`);
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

function getPhoneVariants(phone: string) {
  const normalized = phone.replace(/[\s-]/g, "");

  if (normalized.startsWith("+63")) {
    return [normalized, `0${normalized.slice(3)}`];
  }

  if (normalized.startsWith("0")) {
    return [normalized, `+63${normalized.slice(1)}`];
  }

  return [normalized];
}

function getWalkInCustomerValues(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim()
  };
}

export async function checkWalkInCustomerAction(
  _prevState: WalkInBookingActionState,
  formData: FormData
): Promise<WalkInBookingActionState> {
  await requireAdminSession();

  const parsed = walkInCustomerSchema.safeParse(getWalkInCustomerValues(formData));

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      message: "Please enter the customer's name, email, and mobile number.",
      fieldErrors: {
        fullName: flattened.fullName?.[0],
        email: flattened.email?.[0],
        phone: flattened.phone?.[0]
      }
    };
  }

  const phoneVariants = getPhoneVariants(parsed.data.phone);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: parsed.data.email }, { phone: { in: phoneVariants } }]
    },
    select: { email: true, phone: true }
  });

  if (existing) {
    return {
      message: "This customer already has an account. Ask them to sign in and complete the booking and payment from their own phone.",
      existingCustomer: existing
    };
  }

  return {
    success: "Customer details are new. Continue with the walk-in booking.",
    customer: parsed.data
  };
}

export async function createWalkInBookingAction(
  _prevState: WalkInBookingActionState,
  formData: FormData
): Promise<WalkInBookingActionState> {
  await requireAdminSession();

  const parsed = adminWalkInBookingSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    facilityId: String(formData.get("facilityId") ?? ""),
    dateKey: String(formData.get("dateKey") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    durationMinutes: Number.parseInt(String(formData.get("durationMinutes") ?? ""), 10),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    paymentReference: String(formData.get("paymentReference") ?? "")
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      message: "Please correct the walk-in booking form.",
      fieldErrors: {
        fullName: flattened.fullName?.[0],
        email: flattened.email?.[0],
        phone: flattened.phone?.[0],
        facilityId: flattened.facilityId?.[0],
        dateKey: flattened.dateKey?.[0],
        startTime: flattened.startTime?.[0],
        durationMinutes: flattened.durationMinutes?.[0],
        paymentMethod: flattened.paymentMethod?.[0],
        paymentReference: flattened.paymentReference?.[0]
      }
    };
  }

  const phoneVariants = getPhoneVariants(parsed.data.phone);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: parsed.data.email }, { phone: { in: phoneVariants } }]
    },
    select: { email: true, phone: true }
  });

  if (existing) {
    return {
      message: "This customer already has an account. Ask them to sign in and complete the booking and payment from their own phone.",
      existingCustomer: existing
    };
  }

  const email = parsed.data.email;
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date()
    },
    create: {
      email: email.toLowerCase(),
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      passwordHash: await hashPassword(crypto.randomUUID()),
      role: "CUSTOMER"
    }
  });

  try {
    await createAdminConfirmedBooking({
      userId: user.id,
      facilityId: parsed.data.facilityId,
      dateKey: parsed.data.dateKey,
      startMinutes: timeToMinutes(parsed.data.startTime),
      durationMinutes: parsed.data.durationMinutes,
      paymentMethod: parsed.data.paymentMethod,
      paymentReference: parsed.data.paymentReference
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Booking could not be created."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/customers");
  revalidatePath("/bookings");
  revalidatePath("/facilities");

  redirect(`/admin/walk-ins?date=${encodeURIComponent(parsed.data.dateKey)}`);
}

export async function verifyPaymentAction(
  _prevState: PaymentReviewActionState,
  formData: FormData
): Promise<PaymentReviewActionState> {
  try {
    const session = await requireAdminSession();
    const parsed = paymentReviewSchema.safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reviewNote: String(formData.get("reviewNote") ?? "")
    });

    if (!parsed.success) {
      return { error: "Payment could not be verified." };
    }

    await verifySubmittedPayment({
      paymentId: parsed.data.paymentId,
      adminUserId: session.user.id,
      reviewNote: parsed.data.reviewNote
    });

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/reports");
    revalidatePath("/bookings");

    return { success: "Payment verified and booking confirmed." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment could not be verified." };
  }
}

export async function rejectPaymentAction(
  _prevState: PaymentReviewActionState,
  formData: FormData
): Promise<PaymentReviewActionState> {
  try {
    const session = await requireAdminSession();
    const parsed = paymentReviewSchema.extend({
      reviewNote: z.string().trim().min(3, "Add a rejection reason.").max(500)
    }).safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reviewNote: String(formData.get("reviewNote") ?? "")
    });

    if (!parsed.success) {
      return { error: "Add a rejection reason before rejecting payment." };
    }

    await rejectSubmittedPayment({
      paymentId: parsed.data.paymentId,
      adminUserId: session.user.id,
      reviewNote: parsed.data.reviewNote
    });

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/reports");
    revalidatePath("/bookings");

    return { success: "Payment rejected. The reservation is no longer blocking inventory." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment could not be rejected." };
  }
}

export async function requestPaymentActionRequiredAction(
  _prevState: PaymentReviewActionState,
  formData: FormData
): Promise<PaymentReviewActionState> {
  try {
    const session = await requireAdminSession();
    const parsed = paymentReviewSchema.extend({
      reviewNote: z.string().trim().min(3, "Add instructions for the customer.").max(500)
    }).safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reviewNote: String(formData.get("reviewNote") ?? "")
    });

    if (!parsed.success) {
      return { error: "Add instructions before requesting more proof." };
    }

    await requestPaymentAction({
      paymentId: parsed.data.paymentId,
      adminUserId: session.user.id,
      reviewNote: parsed.data.reviewNote
    });

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/bookings");

    return { success: "Marked as needing customer action." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment could not be updated." };
  }
}
