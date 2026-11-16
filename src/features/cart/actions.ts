"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserSession } from "@/lib/auth/session";
import {
  acknowledgeCurrentCartPrices,
  addCartItem,
  checkoutActiveCart,
  clearActiveCart,
  removeCartItem,
  replaceCartItem
} from "@/server/cart/service";
import { rateLimitPolicies } from "@/lib/config/rate-limits";
import { enforceRequestRateLimit } from "@/lib/security/rate-limit";
import { getSafeActionError } from "@/lib/observability/action-errors";

export type CartActionState = {
  success?: string;
  error?: string;
  fieldErrors?: Partial<Record<"startMinutes" | "durationMinutes", string>>;
};

const selectionSchema = z.object({
  facilityId: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.number().int().min(0).max(1380).refine((value) => value % 60 === 0, "Choose an hourly start time."),
  durationMinutes: z.number().int().min(60).max(240).refine((value) => value % 60 === 0, "Duration must use hourly increments.")
});

const idSchema = z.string().min(1);
const checkoutSchema = z.string().uuid();

export async function addToCartAction(_state: CartActionState, formData: FormData): Promise<CartActionState> {
  try {
    const session = await requireUserSession();
    const parsed = selectionSchema.safeParse({
      facilityId: String(formData.get("facilityId") ?? ""),
      dateKey: String(formData.get("dateKey") ?? ""),
      startMinutes: Number.parseInt(String(formData.get("startMinutes") ?? ""), 10),
      durationMinutes: Number.parseInt(String(formData.get("durationMinutes") ?? ""), 10)
    });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      return { error: "Choose a valid available schedule.", fieldErrors: { startMinutes: fields.startMinutes?.[0], durationMinutes: fields.durationMinutes?.[0] } };
    }
    const replaceCartItemId = String(formData.get("replaceCartItemId") ?? "").trim();
    if (replaceCartItemId) await replaceCartItem(session.user.id, replaceCartItemId, parsed.data);
    else await addCartItem(session.user.id, parsed.data);
    revalidatePath("/cart");
    revalidatePath("/facilities");
    redirect(`/cart?${replaceCartItemId ? "updated" : "added"}=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    return { error: getSafeActionError(error, "The schedule could not be added to your cart.", "cart.item-add.failed") };
  }
}

export async function removeCartItemAction(_state: CartActionState, formData: FormData): Promise<CartActionState> {
  try {
    const session = await requireUserSession();
    const itemId = idSchema.parse(formData.get("cartItemId"));
    await removeCartItem(session.user.id, itemId);
    revalidatePath("/cart");
    return { success: "Schedule removed from your cart." };
  } catch (error) {
    return { error: getSafeActionError(error, "The schedule could not be removed.", "cart.item-remove.failed") };
  }
}

export async function clearCartAction(state: CartActionState, formData: FormData): Promise<CartActionState> {
  void state;
  void formData;
  try {
    const session = await requireUserSession();
    await clearActiveCart(session.user.id);
    revalidatePath("/cart");
    return { success: "Your cart is now empty." };
  } catch (error) {
    return { error: getSafeActionError(error, "The cart could not be cleared.", "cart.clear.failed") };
  }
}

export async function acknowledgeCartPricesAction(state: CartActionState, formData: FormData): Promise<CartActionState> {
  void state;
  void formData;
  try {
    const session = await requireUserSession();
    await acknowledgeCurrentCartPrices(session.user.id);
    revalidatePath("/cart");
    return { success: "Updated prices accepted. You can continue to checkout." };
  } catch (error) {
    return { error: getSafeActionError(error, "Cart prices could not be refreshed.", "cart.prices-refresh.failed") };
  }
}

export async function checkoutCartAction(_state: CartActionState, formData: FormData): Promise<CartActionState> {
  try {
    const session = await requireUserSession();
    await enforceRequestRateLimit({ action: "cart.checkout", userId: session.user.id, policy: rateLimitPolicies.booking() });
    const idempotencyKey = checkoutSchema.parse(formData.get("idempotencyKey"));
    const order = await checkoutActiveCart({ userId: session.user.id, idempotencyKey });
    revalidatePath("/cart");
    revalidatePath("/bookings");
    revalidatePath("/facilities");
    revalidatePath("/admin/payments");
    redirect(`/orders/${order.id}/payment?created=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    return { error: getSafeActionError(error, "Checkout could not be completed.", "cart.checkout.failed") };
  }
}
