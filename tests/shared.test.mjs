import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const shared = require("../shared.js");

describe("PayPal.Me link handling", () => {
  it("generates a PayPal.Me premium URL with amount and currency", () => {
    expect(
      shared.createPayPalMeUrl("https://paypal.me/TiniFlegar", {
        amount: "10",
        currency: "eur"
      })
    ).toBe("https://paypal.me/TiniFlegar/10EUR");
  });

  it("rejects malformed PayPal.Me URLs", () => {
    expect(shared.validatePayPalMeUrl("http://paypal.me/not-secure").isValid).toBe(false);
    expect(shared.validatePayPalMeUrl("https://example.com/pay").isValid).toBe(false);
  });

  it("falls back to a generated PayPal.Me URL when no hosted checkout is configured", () => {
    const links = shared.resolveCheckoutLinks({
      preferredCheckoutUrl: "",
      premiumPayPalMeBaseUrl: "https://paypal.me/TiniFlegar",
      premiumAmount: "10",
      premiumCurrency: "EUR",
      donationPayPalMeBaseUrl: "https://paypal.me/TiniFlegar"
    });

    expect(links.premium.isValid).toBe(true);
    expect(links.premium.url).toBe("https://paypal.me/TiniFlegar/10EUR");
    expect(links.premium.usesPayPalMe).toBe(true);
    expect(links.donation.url).toBe("https://paypal.me/TiniFlegar");
  });
});

describe("Schedule and allowlist logic", () => {
  it("supports overnight schedules across midnight", () => {
    const automation = {
      scheduleEnabled: true,
      activeDays: [1, 2, 3, 4, 5],
      startTime: "22:00",
      endTime: "06:00"
    };

    expect(shared.isWithinSchedule(automation, new Date("2026-03-24T23:30:00"))).toBe(true);
    expect(shared.isWithinSchedule(automation, new Date("2026-03-25T04:45:00"))).toBe(true);
    expect(shared.isWithinSchedule(automation, new Date("2026-03-29T08:00:00"))).toBe(false);
  });

  it("matches allowlist channel and watch rules safely", () => {
    const allowlist = {
      rules: ["@flegartech", "/watch?v=abc123"]
    };

    expect(shared.urlMatchesAllowlist("https://www.youtube.com/@flegartech/videos", allowlist)).toBe(true);
    expect(shared.urlMatchesAllowlist("https://www.youtube.com/watch?v=abc123", allowlist)).toBe(true);
    expect(shared.urlMatchesAllowlist("https://www.youtube.com/watch?v=nope", allowlist)).toBe(false);
  });
});
