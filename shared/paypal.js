(function (global) {
  "use strict";

  const SUPPORT_LINKS = (global.RealDealShared?.SUPPORT_LINKS || []).map((entry) => ({ ...entry }));

  function normalizePayPalMeLink(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim().replace(/^https?:\/\//i, "");
    const match = trimmed.match(/^(?:www\.)?(paypal\.me|paypal\.com)\/(.+)$/i);
    if (!match) {
      return null;
    }

    const hostname = match[1].toLowerCase();
    let path = `/${match[2]}`.replace(/\/+/g, "/").replace(/\/$/, "");

    if (hostname === "paypal.com") {
      if (!path.toLowerCase().startsWith("/paypalme/")) {
        return null;
      }
      path = path.slice("/paypalme".length);
    }

    const segments = path.split("/").filter(Boolean);
    if (!segments.length || !/^[a-zA-Z0-9._-]{2,64}$/.test(segments[0])) {
      return null;
    }

    return `https://paypal.me/${segments[0]}`;
  }

  function isValidAmount(value) {
    if (value == null || value === "") {
      return false;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 && numeric < 1000000;
  }

  function buildPayPalMeUrl(baseLink, amount) {
    const normalized = normalizePayPalMeLink(baseLink);
    if (!normalized) {
      return null;
    }

    if (amount == null || amount === "") {
      return normalized;
    }

    if (!isValidAmount(amount)) {
      return null;
    }

    const normalizedAmount = Number(amount).toFixed(2).replace(/\.00$/, "");
    return `${normalized}/${normalizedAmount}`;
  }

  function getSupportDestinations(entries) {
    return (entries || SUPPORT_LINKS).map((entry) => {
      const normalizedBase = normalizePayPalMeLink(entry.baseUrl);
      const url = buildPayPalMeUrl(normalizedBase, entry.amount);

      if (!entry.baseUrl) {
        return {
          ...entry,
          disabled: true,
          reason: "Missing PayPal.me link",
          url: null
        };
      }

      if (!normalizedBase || !url) {
        return {
          ...entry,
          disabled: true,
          reason: "Invalid PayPal.me link",
          url: null
        };
      }

      return {
        ...entry,
        disabled: false,
        reason: "",
        normalizedBase,
        url
      };
    });
  }

  function hasAnyValidSupportLink(entries) {
    return getSupportDestinations(entries).some((entry) => !entry.disabled);
  }

  global.RealDealPayPal = {
    SUPPORT_LINKS,
    normalizePayPalMeLink,
    isValidAmount,
    buildPayPalMeUrl,
    getSupportDestinations,
    hasAnyValidSupportLink
  };
})(globalThis);
