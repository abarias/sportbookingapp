"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitPaymentProofAction, type PaymentProofActionState } from "@/features/bookings/actions";
import { Button } from "@/components/ui/button";

const initialState: PaymentProofActionState = {};
const maxProofFileSizeBytes = 5 * 1024 * 1024;

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Submitting proof..." : "Submit proof for verification"}</Button>;
}

export function PaymentProofForm({ bookingId, amountDue }: { bookingId: string; amountDue: number }) {
  const [state, action] = useActionState(submitPaymentProofAction, initialState);
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form
      action={action}
      className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const fileInput = form.elements.namedItem("proofImage");

        if (!(fileInput instanceof HTMLInputElement)) {
          return;
        }

        const file = fileInput.files?.[0];

        if (file && file.size > maxProofFileSizeBytes) {
          event.preventDefault();
          setFileError("Payment proof image must be 5MB or smaller.");
        }
      }}
    >
      <input name="bookingId" type="hidden" value={bookingId} />
      <div>
        <h2 className="text-lg font-semibold text-white">Submit payment proof</h2>
        <p className="mt-1 text-sm text-stone-400">Uploading a receipt does not confirm your booking yet. Staff will verify the payment first.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Payment method</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="method" required>
            <option value="manual_gcash">GCash transfer</option>
            <option value="manual_bank_transfer">Bank transfer</option>
          </select>
          {state.fieldErrors?.method ? <p className="text-sm text-rose-300">{state.fieldErrors.method}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Amount paid</span>
          <input
            className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white"
            defaultValue={(amountDue / 100).toFixed(2)}
            min="1"
            name="amountPaid"
            required
            step="0.01"
            type="number"
          />
          {state.fieldErrors?.amountPaid ? <p className="text-sm text-rose-300">{state.fieldErrors.amountPaid}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Transfer reference number</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="externalReference" required />
          {state.fieldErrors?.externalReference ? <p className="text-sm text-rose-300">{state.fieldErrors.externalReference}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Payment date and time</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="paidAt" required type="datetime-local" />
          {state.fieldErrors?.paidAt ? <p className="text-sm text-rose-300">{state.fieldErrors.paidAt}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Receipt screenshot or image</span>
          <input
            accept="image/*"
            className="w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white"
            name="proofImage"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              setFileError(file && file.size > maxProofFileSizeBytes ? "Payment proof image must be 5MB or smaller." : null);
            }}
            required
            type="file"
          />
          <p className="text-xs text-stone-400">Accepted image uploads up to 5MB.</p>
          {fileError ? <p className="text-sm text-rose-300">{fileError}</p> : null}
          {state.fieldErrors?.proofImage ? <p className="text-sm text-rose-300">{state.fieldErrors.proofImage}</p> : null}
        </label>
      </div>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <SubmitButton />
    </form>
  );
}
