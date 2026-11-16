import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RateCard } from "@/components/pricing/rate-card";

describe("RateCard", () => {
  it("renders accessible VAT-exclusive base-rate terminology", () => {
    const html = renderToStaticMarkup(
      <RateCard rows={[{ key: "weekday", applicableDays: "Monday-Friday", timeLabel: "8:00 AM-5:00 PM", rateLabel: "Weekday", amountMinor: 150000, unitLabel: "per hour", effectiveLabel: null }]} />
    );
    expect(html).toContain("Base rate card");
    expect(html).toContain("exclusive of VAT");
    expect(html).toContain("Monday-Friday");
    expect(html).toContain("₱1,500.00");
    expect(html).toContain("aria-labelledby=\"rate-card-title\"");
  });
});
