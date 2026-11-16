import Image from "next/image";

type CustomerBankTransferDetailsProps = {
  reference: string;
  amountMinor: number;
  statusLabel: string;
  showStatus?: boolean;
};

export function CustomerBankTransferDetails({ reference, amountMinor, statusLabel, showStatus = true }: CustomerBankTransferDetailsProps) {
  return (
    <section aria-labelledby="bank-transfer-details" className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 sm:p-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Payment instructions</p>
            <h2 className="mt-1 text-lg font-semibold text-white" id="bank-transfer-details">Pay by bank transfer</h2>
            <p className="mt-1 text-sm leading-6 text-stone-300">Transfer the exact amount, then upload your receipt below. Your booking is confirmed after staff verification.</p>
            {showStatus ? <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-100">Status: {statusLabel}</p> : null}
          </div>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-stone-500">Account name</dt><dd className="font-medium text-white">Stellar Metro Sports Corporation</dd></div>
            <div><dt className="text-stone-500">Bank</dt><dd className="font-medium text-white">Philippine National Bank (PNB)</dd></div>
            <div><dt className="text-stone-500">Account number</dt><dd className="font-medium tracking-wide text-white">1439 7000 3964</dd></div>
            <div><dt className="text-stone-500">Amount to transfer</dt><dd className="font-medium text-amber-200">₱{(amountMinor / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</dd></div>
            <div className="sm:col-span-2"><dt className="text-stone-500">Reference (include in transfer remarks when possible)</dt><dd className="font-medium text-white">{reference}</dd></div>
          </dl>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-2 text-center">
          <Image alt="MMG Stellar PNB QR payment code" height={696} src="/payment/MMG_STELLAR_PNB_QR.jpg" unoptimized width={600} className="h-auto w-full rounded-lg" />
          <a className="w-full rounded-full bg-stone-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-800" download="MMG-Stellar-PNB-QR.jpg" href="/payment/MMG_STELLAR_PNB_QR.jpg">Download QR code</a>
          <p className="text-[11px] leading-4 text-stone-500">On mobile, you can also long-press the QR image to save it.</p>
        </div>
      </div>
    </section>
  );
}
