"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  acknowledgeCartPricesAction,
  checkoutCartAction,
  clearCartAction,
  removeCartItemAction,
  type CartActionState
} from "@/features/cart/actions";
import { createIdempotencyKey } from "@/lib/idempotency";

const initialState: CartActionState = {};

function PendingButton({ children, className = "", disabled = false }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={disabled || pending} type="submit">{pending ? "Saving..." : children}</button>;
}

export function RemoveCartItemButton({ cartItemId }: { cartItemId: string }) {
  const [state, action] = useActionState(removeCartItemAction, initialState);
  return (
    <form action={action} className="space-y-2" onSubmit={(event) => { if (!window.confirm("Remove this schedule from your cart?")) event.preventDefault(); }}>
      <input name="cartItemId" type="hidden" value={cartItemId} />
      <PendingButton className="text-sm font-medium text-rose-200 underline-offset-4 hover:underline">Remove</PendingButton>
      <div aria-live="polite">{state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}</div>
    </form>
  );
}

export function CartSummaryActions({ canCheckout, hasPriceChanges }: { canCheckout: boolean; hasPriceChanges: boolean }) {
  const [idempotencyKey] = useState(createIdempotencyKey);
  const [checkoutState, checkoutAction] = useActionState(checkoutCartAction, initialState);
  const [clearState, clearAction] = useActionState(clearCartAction, initialState);
  const [priceState, priceAction] = useActionState(acknowledgeCartPricesAction, initialState);
  const state = checkoutState.error || checkoutState.success ? checkoutState : clearState.error || clearState.success ? clearState : priceState;

  return (
    <div className="space-y-4">
      {hasPriceChanges ? (
        <form action={priceAction}>
          <PendingButton className="w-full rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950 disabled:opacity-60">Accept updated prices</PendingButton>
        </form>
      ) : (
        <form action={checkoutAction} onSubmit={(event) => { if (!window.confirm("Confirm checkout and hold every listed schedule for payment?")) event.preventDefault(); }}>
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
          <PendingButton className="w-full rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950 disabled:opacity-60" disabled={!canCheckout}>{canCheckout ? "Confirm consolidated checkout" : "Resolve cart issues before checkout"}</PendingButton>
        </form>
      )}
      <form action={clearAction} onSubmit={(event) => { if (!window.confirm("Clear every schedule from your cart?")) event.preventDefault(); }}>
        <PendingButton className="w-full rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-stone-200 hover:bg-white/5">Clear cart</PendingButton>
      </form>
      <div aria-live="polite">
        {state.error ? <p className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{state.error}</p> : null}
        {state.success ? <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">{state.success}</p> : null}
      </div>
    </div>
  );
}
