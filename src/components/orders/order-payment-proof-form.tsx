"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { PaymentMethodMenu } from "@/components/bookings/payment-method-menu";
import { Button } from "@/components/ui/button";
import { submitOrderPaymentProofAction, type OrderPaymentProofActionState } from "@/features/orders/actions";

const initialState: OrderPaymentProofActionState = {};
const maxProofFileSizeBytes = 5 * 1024 * 1024;

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending} type="submit">{pending ? "Submitting proof..." : "Submit consolidated proof"}</Button>;
}

export function OrderPaymentProofForm({ bookingOrderId }: { bookingOrderId: string }) {
  const [state, action] = useActionState(submitOrderPaymentProofAction, initialState);
  const [method, setMethod] = useState("manual_gcash");
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6" onSubmit={(event) => {
      const input = event.currentTarget.elements.namedItem("proofImage");
      if (input instanceof HTMLInputElement && input.files?.[0] && input.files[0].size > maxProofFileSizeBytes) {
        event.preventDefault();
        setFileError("Payment proof image must be 5MB or smaller.");
      }
    }}>
      <input name="bookingOrderId" type="hidden" value={bookingOrderId} />
      <div><h2 className="text-lg font-semibold text-white">Submit one proof for the complete order</h2><p className="mt-1 text-sm text-stone-400">Staff will verify this consolidated payment before confirming every included booking.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2 text-sm text-stone-200"><legend>Payment method</legend><PaymentMethodMenu name="method" onChange={setMethod} value={method} />{state.fieldErrors?.method ? <p className="text-rose-300">{state.fieldErrors.method}</p> : null}</fieldset>
        <label className="space-y-2 text-sm text-stone-200"><span>Transfer reference number</span><input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="externalReference" required />{state.fieldErrors?.externalReference ? <p className="text-rose-300">{state.fieldErrors.externalReference}</p> : null}</label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2"><span>Receipt screenshot or image</span><input accept="image/jpeg,image/png,image/webp,image/gif" className="w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" name="proofImage" onChange={(event) => { const file = event.currentTarget.files?.[0]; setFileError(file && file.size > maxProofFileSizeBytes ? "Payment proof image must be 5MB or smaller." : null); }} required type="file" /><p className="text-xs text-stone-400">JPEG, PNG, WebP, or GIF up to 5MB.</p>{fileError || state.fieldErrors?.proofImage ? <p className="text-rose-300">{fileError ?? state.fieldErrors?.proofImage}</p> : null}</label>
      </div>
      <div aria-live="polite">{state.error ? <p className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">{state.error}</p> : null}</div>
      <SubmitButton />
    </form>
  );
}
