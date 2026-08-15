"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { requireUserSession } from "@/lib/auth/session";
import { cancelBookingByCustomer, createBookingHold } from "@/server/bookings/service";
import { submitManualPaymentProof } from "@/server/payments/service";

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
  fieldErrors?: Partial<Record<"method" | "amountPaid" | "externalReference" | "paidAt" | "proofImage", string>>;
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
    .refine((value) => value % 30 === 0, "Start time must align with 30-minute slots."),
  durationMinutes: z
    .number()
    .int()
    .min(30, "Duration must be at least 30 minutes.")
    .max(240, "Duration is too long.")
    .refine((value) => value % 30 === 0, "Duration must be in 30-minute increments.")
});

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, "Booking is required.")
});

const paymentProofSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(["manual_gcash", "manual_bank_transfer"]),
  amountPaidMinor: z.number().int().positive("Enter the amount paid."),
  externalReference: z.string().trim().min(4, "Enter the transfer reference number.").max(120),
  paidAt: z.coerce.date()
});

function parseAmountMinor(value: FormDataEntryValue | null) {
  const amount = Number.parseFloat(String(value ?? ""));
  return Math.round(amount * 100);
}

async function persistPaymentProofUpload(formData: FormData, bookingId: string) {
  const file = formData.get("proofImage");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Upload a payment proof image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Payment proof image must be 5MB or smaller.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Payment proof must be an image file.");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "payment-proofs");
  await mkdir(uploadDir, { recursive: true });

  const extension = path.extname(file.name) || ".jpg";
  const fileName = `${bookingId}-${Date.now()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(uploadDir, fileName), bytes);

  return `/uploads/payment-proofs/${fileName}`;
}

export async function createBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  try {
    const session = await requireUserSession();
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

    if (error instanceof Error) {
      return {
        error: error.message
      };
    }

    return {
      error: "Booking could not be created."
    };
  }
}

export async function submitPaymentProofAction(
  _prevState: PaymentProofActionState,
  formData: FormData
): Promise<PaymentProofActionState> {
  try {
    const session = await requireUserSession();
    const parsed = paymentProofSchema.safeParse({
      bookingId: String(formData.get("bookingId") ?? ""),
      method: String(formData.get("method") ?? ""),
      amountPaidMinor: parseAmountMinor(formData.get("amountPaid")),
      externalReference: String(formData.get("externalReference") ?? ""),
      paidAt: String(formData.get("paidAt") ?? "")
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;

      return {
        error: "Please correct the payment proof details.",
        fieldErrors: {
          method: flattened.method?.[0],
          amountPaid: flattened.amountPaidMinor?.[0],
          externalReference: flattened.externalReference?.[0],
          paidAt: flattened.paidAt?.[0]
        }
      };
    }

    const proofImageUrl = await persistPaymentProofUpload(formData, parsed.data.bookingId);

    await submitManualPaymentProof({
      bookingId: parsed.data.bookingId,
      userId: session.user.id,
      method: parsed.data.method,
      amountPaidMinor: parsed.data.amountPaidMinor,
      externalReference: parsed.data.externalReference,
      paidAt: parsed.data.paidAt,
      proofImageUrl
    });

    revalidatePath(`/bookings/${parsed.data.bookingId}/payment`);
    revalidatePath("/bookings");
    revalidatePath("/admin");
    revalidatePath("/admin/payments");

    return {
      success: "Payment proof submitted. Staff will verify your payment before confirming the booking."
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Payment proof could not be submitted."
    };
  }
}

export async function cancelBookingAction(
  _prevState: CancelBookingActionState,
  formData: FormData
): Promise<CancelBookingActionState> {
  try {
    const session = await requireUserSession();
    const parsed = cancelBookingSchema.safeParse({
      bookingId: String(formData.get("bookingId") ?? "")
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

    revalidatePath("/bookings");
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    revalidatePath("/admin/reports");
    revalidatePath("/facilities");

    return {
      success: "Booking cancelled successfully. Any refund handling will be coordinated by staff."
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error) {
      return {
        error: error.message
      };
    }

    return {
      error: "Booking could not be cancelled."
    };
  }
}
