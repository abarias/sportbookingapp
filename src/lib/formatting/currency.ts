const philippinePesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

export function formatCurrency(amountMinor: number, currency: "PHP") {
  if (currency !== "PHP") {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  return philippinePesoFormatter.format(amountMinor / 100);
}
