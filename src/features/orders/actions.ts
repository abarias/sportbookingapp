"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserSession } from "@/lib/auth/session";
import { storePaymentProof } from "@/lib/storage/payment-proofs";
import { submitOrderPaymentProof } from "@/server/orders/service";
import { rateLimitPolicies } from "@/lib/config/rate-limits";
import { enforceRequestRateLimit } from "@/lib/security/rate-limit";
import { getSafeActionError } from "@/lib/observability/action-errors";

export type OrderPaymentProofActionState = {
  success?: string;
  error?: string;
  fieldErrors?: Partial<Record<"method" | "externalReference" | "proofImage", string>>;
};

const schema = z.object({
  bookingOrderId: z.string().min(1),
  method: z.enum(["manual_gcash", "manual_bank_transfer"]),
  externalReference: z.string().trim().min(4, "Enter the transfer reference number.").max(120)
});

export async function submitOrderPaymentProofAction(
  _state: OrderPaymentProofActionState,
  formData: FormData
): Promise<OrderPaymentProofActionState> {
  try {
    const session = await requireUserSession();
    await enforceRequestRateLimit({ action: "order-payment-proof.submit", userId: session.user.id, policy: rateLimitPolicies.paymentProof() });
    const parsed = schema.safeParse({
      bookingOrderId: String(formData.get("bookingOrderId") ?? ""),
      method: String(formData.get("method") ?? ""),
      externalReference: String(formData.get("externalReference") ?? "")
    });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      return { error: "Please correct the payment proof details.", fieldErrors: { method: fields.method?.[0], externalReference: fields.externalReference?.[0] } };
    }
    const file = formData.get("proofImage");
    if (!(file instanceof File) || file.size === 0) return { error: "Upload a payment proof image.", fieldErrors: { proofImage: "Choose an image file." } };
    if (file.size > 5 * 1024 * 1024) return { error: "Payment proof image must be 5MB or smaller.", fieldErrors: { proofImage: "Choose an image up to 5MB." } };
    const proofImageUrl = await storePaymentProof(file, parsed.data.bookingOrderId, "orders");
    await submitOrderPaymentProof({ ...parsed.data, userId: session.user.id, proofImageUrl });
    revalidatePath(`/orders/${parsed.data.bookingOrderId}`);
    revalidatePath(`/orders/${parsed.data.bookingOrderId}/payment`);
    revalidatePath("/bookings");
    revalidatePath("/admin/payments");
    redirect(`/orders/${parsed.data.bookingOrderId}/payment?submitted=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    return { error: getSafeActionError(error, "Payment proof could not be submitted.", "order-payment-proof.submit.failed") };
  }
}
