"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { FacilityType } from "@prisma/client";

import { adminWalkInBookingSchema, blockedScheduleSchema, facilityCreateSchema, facilityUpdateSchema, walkInCustomerSchema } from "@/features/admin/schemas";
import { resolveFacilityCapabilities } from "@/features/admin/facility-permissions";
import { hashPassword } from "@/lib/auth/password";
import { requireAllPermissions, requireAnyPermission, requirePermission } from "@/lib/auth/authorization";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { storeFacilityImages } from "@/lib/storage/facility-images";
import { createAdminConfirmedBooking } from "@/server/bookings/service";
import { rejectSubmittedPayment, requestPaymentAction, verifySubmittedPayment } from "@/server/payments/service";
import { rejectOrderPayment, requestOrderPaymentAction, verifyOrderPayment } from "@/server/orders/service";

async function paymentBelongsToOrder(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { bookingOrderId: true } });
  if (!payment) throw new Error("Payment was not found.");
  return Boolean(payment.bookingOrderId);
}

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

  const slug = slugify(slugSeed) || "facility";
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

  return storeFacilityImages(files, slug);
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

function buildBlockedScheduleDate(dateKey: string, time: string, timezone: string) {
  if (time === "24:00") {
    return addDays(fromZonedTime(`${dateKey}T00:00:00`, timezone), 1);
  }

  return fromZonedTime(`${dateKey}T${time}:00`, timezone);
}

export type FacilityActionState = {
  success?: string;
  message?: string;
  section?: "details" | "images" | "schedule";
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
  const authorization = await requirePermission("facilities.manage");
  const cancellationWindowHours = parseNullablePositiveInteger(formData.get("cancellationWindowHours"));

  if (cancellationWindowHours === null || !Number.isFinite(cancellationWindowHours) || cancellationWindowHours < 1) {
    throw new Error("Cancellation window must be at least 1 hour.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "booking.cancellationEnabled" },
      update: {
        value: parseBoolean(formData.get("enabled"))
      },
      create: {
        key: "booking.cancellationEnabled",
        value: parseBoolean(formData.get("enabled"))
      }
    });
    await tx.appSetting.upsert({
      where: { key: "booking.cancellationWindowHours" },
      update: {
        value: cancellationWindowHours
      },
      create: {
        key: "booking.cancellationWindowHours",
        value: cancellationWindowHours
      }
    });
    await writeAuditLog(tx, { actorUserId: authorization.session.user.id, action: "facility.cancellation_policy_updated", entityType: "AppSetting", entityId: "booking.cancellationEnabled", after: { enabled: parseBoolean(formData.get("enabled")), cancellationWindowHours } });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
}

export async function updateFacilityAction(
  _prevState: FacilityActionState,
  formData: FormData
): Promise<FacilityActionState> {
  const facilityId = String(formData.get("facilityId") ?? "");
  const requestedSection = String(formData.get("saveSection") ?? "details");
  const section = requestedSection === "images" || requestedSection === "schedule" ? requestedSection : "details";
  const authorization = section === "images"
    ? await requirePermission("facility_photos.manage")
    : section === "schedule"
      ? await requirePermission("facilities.manage")
      : await requireAnyPermission(["facility_content.edit", "facilities.manage", "pricing.manage"]);
  const capabilities = resolveFacilityCapabilities(authorization.permissions);
  const canManageContent = capabilities.content;
  const canManageFacilities = capabilities.operations;
  const canManagePricing = capabilities.pricing;
  const session = authorization.session;

  const existing = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      operatingHours: { orderBy: { dayOfWeek: "asc" } },
      pricingRules: { where: { isActive: true, dayType: "DEFAULT" }, orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (!existing) return { section, message: "Facility not found." };

  let imageUrls = existing.images.map((image) => image.url);
  if (section === "images") {
    const retainedUrls = String(formData.get("imageUrls") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
    try {
      imageUrls = [...retainedUrls, ...await persistFacilityUploads(formData, existing.name)];
    } catch (error) {
      return { section, message: error instanceof Error ? error.message : "Facility images could not be uploaded." };
    }
  }

  const weekdays = section === "schedule"
    ? buildWeekdays(formData)
    : existing.operatingHours.map(({ dayOfWeek, opensAtMinutes, closesAtMinutes, isClosed }) => ({ dayOfWeek, opensAtMinutes, closesAtMinutes, isClosed }));
  const requestedCancellationWindow = parseNullablePositiveInteger(formData.get("cancellationWindowHoursOverride"));
  const cancellationWindowHoursOverride = section === "schedule" ? requestedCancellationWindow : existing.cancellationWindowHoursOverride;
  const currentPricing = existing.pricingRules[0];

  const parsed = facilityUpdateSchema.safeParse({
    facilityId,
    name: section === "details" && canManageContent ? String(formData.get("name") ?? "") : existing.name,
    description: section === "details" && canManageContent ? String(formData.get("description") ?? "") : existing.description,
    isEnabled: section === "details" && canManageFacilities ? parseBoolean(formData.get("isEnabled")) : existing.isEnabled,
    amountMinor: section === "details" && canManagePricing ? parseAmountMinor(formData.get("amount")) : currentPricing?.amountMinor ?? 0,
    imageUrls,
    cancellationEnabledOverride: section === "schedule"
      ? String(formData.get("cancellationEnabledOverride") ?? "inherit")
      : existing.cancellationEnabledOverride === null ? "inherit" : existing.cancellationEnabledOverride ? "enabled" : "disabled",
    operatingHours: weekdays
  });

  if (!parsed.success || (cancellationWindowHoursOverride !== null && (!Number.isFinite(cancellationWindowHoursOverride) || cancellationWindowHoursOverride < 1))) {
    const flattened = parsed.success ? undefined : parsed.error.flatten().fieldErrors;
    const operatingHourIssue = parsed.success ? undefined : parsed.error.issues.find((issue) => issue.path[0] === "operatingHours");

    return {
      section,
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
    if (section === "details") {
      await tx.facility.update({
        where: { id: parsed.data.facilityId },
        data: {
          ...(canManageContent ? { name: parsed.data.name, description: parsed.data.description } : {}),
          ...(canManageFacilities ? { isEnabled: parsed.data.isEnabled } : {})
        }
      });
    } else if (section === "images") {
      await tx.facility.update({
        where: { id: parsed.data.facilityId },
        data: { images: { deleteMany: {}, create: parsed.data.imageUrls.map((url, index) => ({ url, altText: `${existing.name} image ${index + 1}`, sortOrder: index })) } }
      });
    } else {
      await tx.facility.update({
        where: { id: parsed.data.facilityId },
        data: {
          cancellationEnabledOverride: parseNullableBoolean(parsed.data.cancellationEnabledOverride),
          cancellationWindowHoursOverride,
          operatingHours: { deleteMany: {}, create: parsed.data.operatingHours }
        }
      });
    }

    const nextPrice = parsed.data.amountMinor;
    const nextMinimumMinutes = 60;

    if (section === "details" && canManagePricing && (!currentPricing || currentPricing.amountMinor !== nextPrice || currentPricing.minimumMinutes !== nextMinimumMinutes)) {
      await tx.pricingRule.updateMany({
        where: { facilityId: parsed.data.facilityId, isActive: true, dayType: "DEFAULT" },
        data: { isActive: false }
      });

      await tx.pricingRule.create({
        data: {
          facilityId: parsed.data.facilityId,
          name: "Default rate",
          customerLabel: "Standard base rate",
          dayType: "DEFAULT",
          currency: "PHP",
          amountMinor: nextPrice,
          billingMode: "PER_HOUR",
          minimumMinutes: nextMinimumMinutes,
          isActive: true,
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id
        }
      });
    }

    await writeAuditLog(tx, {
      actorUserId: session.user.id,
      action: section === "images" ? "facility.photos_updated" : section === "schedule" ? "facility.operations_updated" : "facility.content_updated",
      entityType: "Facility",
      entityId: existing.id,
      before: { name: existing.name, description: existing.description, isEnabled: existing.isEnabled, imageUrls: existing.images.map((image) => image.url), amountMinor: currentPricing?.amountMinor ?? null },
      after: { section, name: parsed.data.name, description: parsed.data.description, isEnabled: parsed.data.isEnabled, imageUrls: parsed.data.imageUrls, amountMinor: parsed.data.amountMinor }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");

  return {
    section,
    success: "Facility details saved."
  };
}

export async function createFacilityAction(
  _prevState: FacilityActionState,
  formData: FormData
): Promise<FacilityActionState> {
  const { session } = await requireAllPermissions(["facilities.manage", "facility_content.edit", "pricing.manage", "facility_photos.manage"]);

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

  const createdFacility = await prisma.$transaction(async (tx) => {
    const facility = await tx.facility.create({
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
          name: "Default rate",
          customerLabel: "Standard base rate",
          dayType: "DEFAULT",
          currency: "PHP",
          amountMinor: parsed.data.amountMinor,
          billingMode: "PER_HOUR",
          minimumMinutes: 60,
          isActive: true,
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id
        }
      }
      }
    });
    await writeAuditLog(tx, { actorUserId: session.user.id, action: "facility.created", entityType: "Facility", entityId: facility.id, after: { name: facility.name, slug: facility.slug, type: facility.type, isEnabled: facility.isEnabled } });
    return facility;
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");

  redirect(`/admin/facilities?facilityId=${encodeURIComponent(createdFacility.id)}&created=1`);
}

export async function createBlockedScheduleAction(
  _prevState: BlockScheduleActionState,
  formData: FormData
): Promise<BlockScheduleActionState> {
  const { session } = await requirePermission("facilities.manage");

  const parsed = blockedScheduleSchema.safeParse({
    facilityId: String(formData.get("facilityId") ?? ""),
    title: String(formData.get("title") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    allDay: parseBoolean(formData.get("allDay"))
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

  const startAtUtc = buildBlockedScheduleDate(parsed.data.startDate, parsed.data.allDay ? "00:00" : parsed.data.startTime, facility.timezone);
  const endAtUtc = buildBlockedScheduleDate(parsed.data.endDate, parsed.data.allDay ? "24:00" : parsed.data.endTime, facility.timezone);

  await prisma.$transaction(async (tx) => {
    const block = await tx.blockedSchedule.create({
      data: { facilityId: parsed.data.facilityId, title: parsed.data.title, reason: parsed.data.reason || null, startAtUtc, endAtUtc, createdByUserId: session.user.id }
    });
    await writeAuditLog(tx, { actorUserId: session.user.id, action: "facility.schedule_blocked", entityType: "BlockedSchedule", entityId: block.id, after: { facilityId: block.facilityId, title: block.title, startAtUtc: block.startAtUtc.toISOString(), endAtUtc: block.endAtUtc.toISOString() } });
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
  const authorization = await requirePermission("facilities.manage");

  const parsed = deleteBlockScheduleSchema.safeParse({
    blockId: String(formData.get("blockId") ?? "")
  });

  if (!parsed.success) {
    return {
      error: "Blocked schedule could not be deleted."
    };
  }

  await prisma.$transaction(async (tx) => {
    const block = await tx.blockedSchedule.findUnique({ where: { id: parsed.data.blockId } });
    if (!block) throw new Error("Blocked schedule not found.");
    await writeAuditLog(tx, { actorUserId: authorization.session.user.id, action: "facility.schedule_block_removed", entityType: "BlockedSchedule", entityId: block.id, before: { facilityId: block.facilityId, title: block.title, startAtUtc: block.startAtUtc.toISOString(), endAtUtc: block.endAtUtc.toISOString() } });
    await tx.blockedSchedule.delete({ where: { id: block.id } });
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
  await requirePermission("bookings.create");

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
  const authorization = await requirePermission("bookings.create");

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

  let createdBookingId: string;

  try {
    const booking = await createAdminConfirmedBooking({
      userId: user.id,
      facilityId: parsed.data.facilityId,
      dateKey: parsed.data.dateKey,
      startMinutes: timeToMinutes(parsed.data.startTime),
      durationMinutes: parsed.data.durationMinutes,
      paymentMethod: parsed.data.paymentMethod,
      paymentReference: parsed.data.paymentReference
    });
    createdBookingId = booking.id;
    await writeAuditLog(prisma, { actorUserId: authorization.session.user.id, action: "booking.walk_in_created", entityType: "Booking", entityId: booking.id, after: { facilityId: parsed.data.facilityId, customerUserId: user.id, dateKey: parsed.data.dateKey, startTime: parsed.data.startTime, durationMinutes: parsed.data.durationMinutes, paymentMethod: parsed.data.paymentMethod } });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      message: error instanceof Error ? error.message : "Booking could not be created."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/customers");
  revalidatePath("/bookings");
  revalidatePath("/facilities");

  redirect(`/admin/bookings/${createdBookingId}?walkInCreated=1`);
}

export async function verifyPaymentAction(
  _prevState: PaymentReviewActionState,
  formData: FormData
): Promise<PaymentReviewActionState> {
  try {
    const { session } = await requirePermission("payments.verify");
    const parsed = paymentReviewSchema.safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reviewNote: String(formData.get("reviewNote") ?? "")
    });

    if (!parsed.success) {
      return { error: "Payment could not be verified." };
    }

    if (await paymentBelongsToOrder(parsed.data.paymentId)) {
      await verifyOrderPayment({ paymentId: parsed.data.paymentId, adminUserId: session.user.id, reviewNote: parsed.data.reviewNote });
    } else {
      await verifySubmittedPayment({ paymentId: parsed.data.paymentId, adminUserId: session.user.id, reviewNote: parsed.data.reviewNote });
      await writeAuditLog(prisma, { actorUserId: session.user.id, action: "payment.verified", entityType: "Payment", entityId: parsed.data.paymentId, metadata: { reviewNote: parsed.data.reviewNote ?? null } });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/reports");
    revalidatePath("/bookings");
    revalidatePath("/admin/orders");
    revalidatePath("/orders", "layout");

    redirect(`/admin/payments/${parsed.data.paymentId}?outcome=verified`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "Payment could not be verified." };
  }
}

export async function rejectPaymentAction(
  _prevState: PaymentReviewActionState,
  formData: FormData
): Promise<PaymentReviewActionState> {
  try {
    const { session } = await requirePermission("payments.verify");
    const parsed = paymentReviewSchema.extend({
      reviewNote: z.string().trim().min(3, "Add a rejection reason.").max(500)
    }).safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reviewNote: String(formData.get("reviewNote") ?? "")
    });

    if (!parsed.success) {
      return { error: "Add a rejection reason before rejecting payment." };
    }

    if (await paymentBelongsToOrder(parsed.data.paymentId)) {
      await rejectOrderPayment({ paymentId: parsed.data.paymentId, adminUserId: session.user.id, reviewNote: parsed.data.reviewNote });
    } else {
      await rejectSubmittedPayment({ paymentId: parsed.data.paymentId, adminUserId: session.user.id, reviewNote: parsed.data.reviewNote });
      await writeAuditLog(prisma, { actorUserId: session.user.id, action: "payment.rejected", entityType: "Payment", entityId: parsed.data.paymentId, metadata: { reviewNote: parsed.data.reviewNote } });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/reports");
    revalidatePath("/bookings");
    revalidatePath("/admin/orders");
    revalidatePath("/orders", "layout");

    redirect(`/admin/payments/${parsed.data.paymentId}?outcome=rejected`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "Payment could not be rejected." };
  }
}

export async function requestPaymentActionRequiredAction(
  _prevState: PaymentReviewActionState,
  formData: FormData
): Promise<PaymentReviewActionState> {
  try {
    const { session } = await requirePermission("payments.verify");
    const parsed = paymentReviewSchema.extend({
      reviewNote: z.string().trim().min(3, "Add instructions for the customer.").max(500)
    }).safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reviewNote: String(formData.get("reviewNote") ?? "")
    });

    if (!parsed.success) {
      return { error: "Add instructions before requesting more proof." };
    }

    if (await paymentBelongsToOrder(parsed.data.paymentId)) {
      await requestOrderPaymentAction({ paymentId: parsed.data.paymentId, adminUserId: session.user.id, reviewNote: parsed.data.reviewNote });
    } else {
      await requestPaymentAction({ paymentId: parsed.data.paymentId, adminUserId: session.user.id, reviewNote: parsed.data.reviewNote });
      await writeAuditLog(prisma, { actorUserId: session.user.id, action: "payment.action_required", entityType: "Payment", entityId: parsed.data.paymentId, metadata: { reviewNote: parsed.data.reviewNote } });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/bookings");
    revalidatePath("/admin/orders");
    revalidatePath("/orders", "layout");

    redirect(`/admin/payments/${parsed.data.paymentId}?outcome=action-required`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "Payment could not be updated." };
  }
}
