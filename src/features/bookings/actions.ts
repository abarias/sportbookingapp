"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireUserSession } from "@/lib/auth/session";
import { createConfirmedBookingWithMockPayment } from "@/server/bookings/service";

export type BookingActionState = {
  error?: string;
};

export async function createBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  try {
    const session = await requireUserSession();
    const facilityId = String(formData.get("facilityId") ?? "");
    const facilitySlug = String(formData.get("facilitySlug") ?? "");
    const dateKey = String(formData.get("dateKey") ?? "");
    const startMinutes = Number.parseInt(String(formData.get("startMinutes") ?? ""), 10);
    const durationMinutes = Number.parseInt(String(formData.get("durationMinutes") ?? ""), 10);

    if (!facilityId || !facilitySlug || !dateKey || Number.isNaN(startMinutes) || Number.isNaN(durationMinutes)) {
      return { error: "Complete the booking form before continuing." };
    }

    await createConfirmedBookingWithMockPayment({
      userId: session.user.id,
      facilityId,
      dateKey,
      startMinutes,
      durationMinutes
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
