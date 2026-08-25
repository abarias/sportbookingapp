"use server";

import { PriceAdjustmentResolution } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/authorization";
import { requireUserSession } from "@/lib/auth/session";
import { deliverPendingRescheduleNotifications } from "@/lib/notifications/rescheduling";
import { storePaymentProof } from "@/lib/storage/payment-proofs";
import {
  initiateBookingReschedule,
  rejectReschedulePayment,
  resolveLowerPriceAdjustment,
  submitReschedulePaymentProof,
  verifyReschedulePayment
} from "@/server/bookings/rescheduling";

export type RescheduleActionState = {
  error?: string;
  success?: string;
  rescheduleId?: string;
};

const initiateSchema = z.object({
  bookingId: z.string().min(1),
  replacementFacilityId: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.coerce.number().int().min(0).max(1380).refine((value) => value % 60 === 0, "Replacement time must use hourly increments."),
  reason: z.string().trim().min(3, "Enter a rescheduling reason.").max(500),
  internalNote: z.string().trim().max(1000).optional(),
  customerNote: z.string().trim().max(1000).optional(),
  waivedAmount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid waiver amount.").optional().or(z.literal("")),
  idempotencyKey: z.string().uuid()
});

const reviewSchema = z.object({
  reschedulePaymentId: z.string().min(1),
  reviewNote: z.string().trim().max(1000).optional()
});

const rejectSchema = reviewSchema.extend({ reviewNote: z.string().trim().min(3, "Enter a rejection reason.").max(1000) });

const resolutionSchema = z.object({
  rescheduleId: z.string().min(1),
  method: z.enum(["MANUAL_REFUND", "CUSTOMER_CREDIT", "NO_REFUND", "OTHER"]),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid resolution amount."),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().min(3, "Resolution notes are required.").max(1000)
});

function moneyToMinor(value: string | undefined) {
  if (!value) return 0;
  return Math.round(Number(value) * 100);
}

function revalidateReschedulePages(bookingId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/reports");
  revalidatePath("/bookings");
  revalidatePath("/facilities");
  if (bookingId) revalidatePath(`/admin/bookings/${bookingId}`);
}

function scheduleNotificationDelivery() {
  after(async () => {
    await deliverPendingRescheduleNotifications({ batchSize: 10 });
  });
}

export async function initiateRescheduleAction(_state: RescheduleActionState, formData: FormData): Promise<RescheduleActionState> {
  const authorization = await requirePermission("bookings.reschedule");
  const parsed = initiateSchema.safeParse({
    bookingId: formData.get("bookingId"),
    replacementFacilityId: formData.get("replacementFacilityId"),
    dateKey: formData.get("dateKey"),
    startMinutes: formData.get("startMinutes"),
    reason: formData.get("reason"),
    internalNote: formData.get("internalNote"),
    customerNote: formData.get("customerNote"),
    waivedAmount: formData.get("waivedAmount"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the reschedule details." };

  try {
    await initiateBookingReschedule({
      ...parsed.data,
      actorUserId: authorization.session.user.id,
      waivedAmountMinor: moneyToMinor(parsed.data.waivedAmount),
      canOverrideAdjustment: authorization.permissions.has("bookings.reschedule.override_adjustment")
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Booking could not be rescheduled." };
  }
  revalidateReschedulePages(parsed.data.bookingId);
  scheduleNotificationDelivery();
  redirect(`/admin/bookings/${parsed.data.bookingId}?rescheduled=1`);
}

export async function submitReschedulePaymentProofAction(_state: RescheduleActionState, formData: FormData): Promise<RescheduleActionState> {
  const session = await requireUserSession();
  const parsed = z.object({
    rescheduleId: z.string().min(1),
    method: z.enum(["manual_gcash", "manual_bank_transfer"]),
    externalReference: z.string().trim().min(4).max(120)
  }).safeParse({
    rescheduleId: formData.get("rescheduleId"),
    method: formData.get("method"),
    externalReference: formData.get("externalReference")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the payment details." };

  const file = formData.get("proofImage");
  if (!(file instanceof File) || file.size === 0) return { error: "Upload a payment proof image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Payment proof image must be 5MB or smaller." };
  if (!file.type.startsWith("image/")) return { error: "Payment proof must be an image file." };

  try {
    const proofImageUrl = await storePaymentProof(file, `reschedule-${parsed.data.rescheduleId}`);
    const reschedule = await submitReschedulePaymentProof({ ...parsed.data, userId: session.user.id, proofImageUrl });
    revalidateReschedulePages(reschedule.bookingId);
    scheduleNotificationDelivery();
    return { success: "Additional payment proof submitted for verification.", rescheduleId: reschedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Additional payment proof could not be submitted." };
  }
}

export async function verifyReschedulePaymentAction(_state: RescheduleActionState, formData: FormData): Promise<RescheduleActionState> {
  const authorization = await requirePermission("payments.verify");
  const parsed = reviewSchema.safeParse({ reschedulePaymentId: formData.get("reschedulePaymentId"), reviewNote: formData.get("reviewNote") });
  if (!parsed.success) return { error: "Invalid payment review." };
  try {
    const reschedule = await verifyReschedulePayment({ ...parsed.data, adminUserId: authorization.session.user.id });
    revalidateReschedulePages(reschedule.bookingId);
    scheduleNotificationDelivery();
    return { success: "Additional payment verified and booking rescheduled.", rescheduleId: reschedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Additional payment could not be verified." };
  }
}

export async function rejectReschedulePaymentAction(_state: RescheduleActionState, formData: FormData): Promise<RescheduleActionState> {
  const authorization = await requirePermission("payments.verify");
  const parsed = rejectSchema.safeParse({ reschedulePaymentId: formData.get("reschedulePaymentId"), reviewNote: formData.get("reviewNote") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a rejection reason." };
  try {
    const reschedule = await rejectReschedulePayment({ ...parsed.data, adminUserId: authorization.session.user.id });
    revalidateReschedulePages(reschedule.bookingId);
    scheduleNotificationDelivery();
    return { success: "Additional payment rejected. The original booking remains confirmed.", rescheduleId: reschedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Additional payment could not be rejected." };
  }
}

export async function resolveRescheduleAdjustmentAction(_state: RescheduleActionState, formData: FormData): Promise<RescheduleActionState> {
  const authorization = await requirePermission("bookings.reschedule.resolve_adjustment");
  const parsed = resolutionSchema.safeParse({
    rescheduleId: formData.get("rescheduleId"),
    method: formData.get("method"),
    amount: formData.get("amount"),
    reference: formData.get("reference"),
    note: formData.get("note")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the resolution details." };
  try {
    const reschedule = await resolveLowerPriceAdjustment({
      rescheduleId: parsed.data.rescheduleId,
      adminUserId: authorization.session.user.id,
      method: parsed.data.method as Exclude<PriceAdjustmentResolution, "WAIVER">,
      amountMinor: moneyToMinor(parsed.data.amount),
      reference: parsed.data.reference,
      note: parsed.data.note
    });
    revalidateReschedulePages(reschedule.bookingId);
    scheduleNotificationDelivery();
    return { success: "Price adjustment resolution recorded.", rescheduleId: reschedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Adjustment resolution could not be recorded." };
  }
}
