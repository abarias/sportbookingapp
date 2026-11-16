"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { submitPaymentProofAction, type PaymentProofActionState } from "@/features/bookings/actions";
import { Button } from "@/components/ui/button";

const initialState: PaymentProofActionState = {};
const maxProofFileSizeBytes = 5 * 1024 * 1024;

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Submitting proof..." : "Submit proof for verification"}</Button>;
}

export function PaymentProofForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [state, action] = useActionState(submitPaymentProofAction, initialState);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (state.error?.includes("reservation hold has expired")) {
      router.refresh();
    }
  }, [router, state.error]);

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
      <input name="method" type="hidden" value="manual_bank_transfer" />
      <div>
        <h2 className="text-lg font-semibold text-white">Submit payment proof</h2>
        <p className="mt-1 text-sm text-stone-400">Uploading a receipt does not confirm your booking yet. Staff will verify the payment first.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Transfer reference number</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-base text-white" name="externalReference" required />
          {state.fieldErrors?.externalReference ? <p className="text-sm text-rose-300">{state.fieldErrors.externalReference}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Receipt screenshot or image</span>
          <input
            accept="image/*"
            className="w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-base text-white"
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
      <div aria-live="polite">
        {state.error ? <p className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">{state.error}</p> : null}
        {state.success ? <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">{state.success}</p> : null}
      </div>
      {!state.success ? <SubmitButton /> : null}
    </form>
  );
}
