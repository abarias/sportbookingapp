"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireUserSession } from "@/lib/auth/session";
import { storePaymentProof } from "@/lib/storage/payment-proofs";
import { cancelBookingByCustomer, createBookingHold } from "@/server/bookings/service";
import { submitManualPaymentProof } from "@/server/payments/service";
import { rateLimitPolicies } from "@/lib/config/rate-limits";
import { enforceRequestRateLimit } from "@/lib/security/rate-limit";
import { getSafeActionError } from "@/lib/observability/action-errors";

export type BookingActionState = {
  error?: string;
  fieldErrors?: Partial<Record<"durationMinutes" | "startMinutes", string>>;
};

export type CancelBookingActionState = {
  error?: string;
  success?: string;
};

export type PaymentProofActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<"method" | "externalReference" | "proofImage", string>>;
};

const createBookingSchema = z.object({
  facilityId: z.string().min(1),
  facilitySlug: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().uuid(),
  startMinutes: z
    .number()
    .int()
    .min(0, "Choose a valid start time.")
    .max(1410, "Choose a valid start time.")
    .refine((value) => value % 30 === 0, "Start time must align with the facility schedule."),
  durationMinutes: z
    .number()
    .int()
    .min(60, "Duration must be at least 1 hour.")
    .max(240, "Duration is too long.")
    .refine((value) => value % 60 === 0, "Duration must be in hourly increments.")
});

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, "Booking is required."),
  returnTo: z.string().regex(/^\/bookings(?:\/[^/?#]+)?$/, "Invalid return path.").default("/bookings")
});

const paymentProofSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(["manual_gcash", "manual_bank_transfer"]),
  externalReference: z.string().trim().min(4, "Enter the transfer reference number.").max(120)
});

async function persistPaymentProofUpload(formData: FormData, bookingId: string) {
  const file = formData.get("proofImage");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Upload a payment proof image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Payment proof image must be 5MB or smaller.");
  }

  return storePaymentProof(file, bookingId);
}

export async function createBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  try {
    const session = await requireUserSession();
    await enforceRequestRateLimit({ action: "booking.create", userId: session.user.id, policy: rateLimitPolicies.booking() });
    const parsed = createBookingSchema.safeParse({
      facilityId: String(formData.get("facilityId") ?? ""),
      facilitySlug: String(formData.get("facilitySlug") ?? ""),
      dateKey: String(formData.get("dateKey") ?? ""),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      startMinutes: Number.parseInt(String(formData.get("startMinutes") ?? ""), 10),
      durationMinutes: Number.parseInt(String(formData.get("durationMinutes") ?? ""), 10)
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;

      return {
        error: "Complete the booking form before continuing.",
        fieldErrors: {
          durationMinutes: flattened.durationMinutes?.[0],
          startMinutes: flattened.startMinutes?.[0]
        }
      };
    }

    const booking = await createBookingHold({
      userId: session.user.id,
      facilityId: parsed.data.facilityId,
      dateKey: parsed.data.dateKey,
      idempotencyKey: parsed.data.idempotencyKey,
      startMinutes: parsed.data.startMinutes,
      durationMinutes: parsed.data.durationMinutes
    });

    redirect(`/bookings/${booking.id}/payment`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: getSafeActionError(error, "Booking could not be created.", "booking.create.failed") };
  }
}

export async function submitPaymentProofAction(
  _prevState: PaymentProofActionState,
  formData: FormData
): Promise<PaymentProofActionState> {
  try {
    const session = await requireUserSession();
    await enforceRequestRateLimit({ action: "payment-proof.submit", userId: session.user.id, policy: rateLimitPolicies.paymentProof() });
    const parsed = paymentProofSchema.safeParse({
      bookingId: String(formData.get("bookingId") ?? ""),
      method: String(formData.get("method") ?? ""),
      externalReference: String(formData.get("externalReference") ?? "")
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;

      return {
        error: "Please correct the payment proof details.",
        fieldErrors: {
          method: flattened.method?.[0],
          externalReference: flattened.externalReference?.[0]
        }
      };
    }

    const proofImageUrl = await persistPaymentProofUpload(formData, parsed.data.bookingId);

    await submitManualPaymentProof({
      bookingId: parsed.data.bookingId,
      userId: session.user.id,
      method: parsed.data.method,
      externalReference: parsed.data.externalReference,
      proofImageUrl
    });

    revalidatePath(`/bookings/${parsed.data.bookingId}/payment`);
    revalidatePath("/bookings");
    revalidatePath("/admin");
    revalidatePath("/admin/payments");

    redirect(`/bookings/${parsed.data.bookingId}/payment?submitted=1`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: getSafeActionError(error, "Payment proof could not be submitted.", "payment-proof.submit.failed") };
  }
}

export async function cancelBookingAction(
  _prevState: CancelBookingActionState,
  formData: FormData
): Promise<CancelBookingActionState> {
  let returnTo = "/bookings";

  try {
    const session = await requireUserSession();
    await enforceRequestRateLimit({ action: "booking.cancel", userId: session.user.id, policy: rateLimitPolicies.booking() });
    const parsed = cancelBookingSchema.safeParse({
      bookingId: String(formData.get("bookingId") ?? ""),
      returnTo: String(formData.get("returnTo") ?? "/bookings")
    });

    if (!parsed.success) {
      return {
        error: "Booking could not be cancelled."
      };
    }

    await cancelBookingByCustomer({
      bookingId: parsed.data.bookingId,
      userId: session.user.id
    });
    returnTo = parsed.data.returnTo;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: getSafeActionError(error, "Booking could not be cancelled.", "booking.cancel.failed") };
  }

  revalidatePath("/bookings");
  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/reports");
  revalidatePath("/facilities");
  revalidatePath(returnTo);
  redirect(`${returnTo}?cancelled=1`);
}
