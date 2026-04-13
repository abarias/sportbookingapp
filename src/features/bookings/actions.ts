"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";

import { requireUserSession } from "@/lib/auth/session";
import { createConfirmedBookingWithMockPayment } from "@/server/bookings/service";

export type BookingActionState = {
  error?: string;
  fieldErrors?: Partial<Record<"durationMinutes" | "startMinutes", string>>;
};

const createBookingSchema = z.object({
  facilityId: z.string().min(1),
  facilitySlug: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

    await createConfirmedBookingWithMockPayment({
      userId: session.user.id,
      facilityId: parsed.data.facilityId,
      dateKey: parsed.data.dateKey,
      startMinutes: parsed.data.startMinutes,
      durationMinutes: parsed.data.durationMinutes
    });

    redirect("/bookings?created=1&mockPaid=1");
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
