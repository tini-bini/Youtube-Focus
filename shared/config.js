(function (global) {
  "use strict";

  const DEFAULT_SETTINGS = {
    historyDays: 90,
    showBadge: true,
    showInlineLabel: true,
    enableFakeWasDetection: true,
    enablePriceAnchorDetection: true,
    enableUrgencyDetection: true,
    enableRollbackDetection: true,
    enableSubscriptionDetection: true
  };

  const STORAGE_KEYS = {
    settings: "rd_settings",
    popupTargets: "rd_popup_targets",
    targetNotifications: "rd_target_notifications",
    productPrefix: "rd_p_",
    theme: "rd_theme"
  };

  const THEME_ICONS = {
    light: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    dark: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4.25" stroke="currentColor" stroke-width="1.8"></circle>
        <path d="M12 2.5V4.5M12 19.5V21.5M21.5 12H19.5M4.5 12H2.5M18.72 5.28L17.3 6.7M6.7 17.3L5.28 18.72M18.72 18.72L17.3 17.3M6.7 6.7L5.28 5.28" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
    `
  };

  const SUPPORTED_STORES = ["Amazon", "Zalando", "eBay", "Walmart", "AliExpress", "Zara", "H&M"];
  const SUPPORT_LINKS = [
    {
      id: "coffee",
      label: "Buy a coffee",
      baseUrl: "",
      amount: 5
    },
    {
      id: "support",
      label: "Support RealDeal",
      baseUrl: "",
      amount: 15
    }
  ];

  function isProductStorageKey(key) {
    return typeof key === "string" && key.startsWith(STORAGE_KEYS.productPrefix);
  }

  function getProductEntries(snapshot) {
    return Object.entries(snapshot || {}).filter(([key]) => isProductStorageKey(key));
  }

  function getStorageStats(snapshot) {
    const productEntries = getProductEntries(snapshot);
    const observationCount = productEntries.reduce((total, [, value]) => {
      return total + (Array.isArray(value?.history) ? value.history.length : 0);
    }, 0);

    const lowestPrices = productEntries
      .map(([, value]) => value?.lowestPrice)
      .filter((value) => Number.isFinite(value));

    return {
      trackedProducts: productEntries.length,
      observationCount,
      bestDealCount: lowestPrices.length
    };
  }

  function getStoredTheme() {
    try {
      return global.localStorage?.getItem(STORAGE_KEYS.theme) || null;
    } catch {
      return null;
    }
  }

  function resolveTheme() {
    const explicit = getStoredTheme();
    if (explicit === "dark" || explicit === "light") {
      return explicit;
    }

    if (global.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";

    if (global.document?.documentElement) {
      global.document.documentElement.dataset.theme = nextTheme;
    }

    try {
      global.localStorage?.setItem(STORAGE_KEYS.theme, nextTheme);
    } catch {
      // Ignore storage failures in restricted contexts.
    }

    return nextTheme;
  }

  function toggleTheme() {
    return applyTheme(resolveTheme() === "dark" ? "light" : "dark");
  }

  function currencySymbol(currency) {
    return {
      USD: "$",
      EUR: "\u20AC",
      GBP: "\u00A3",
      CAD: "C$",
      AUD: "A$",
      INR: "\u20B9",
      JPY: "\u00A5",
      CHF: "CHF "
    }[currency] || `${currency || ""} `;
  }

  function formatCurrency(amount, currency) {
    if (amount == null || Number.isNaN(Number(amount))) {
      return "--";
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${currencySymbol(currency)}${Number(amount).toFixed(2)}`;
    }
  }

  function roundCurrency(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseUrlParts(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      return null;
    }

    if (typeof URL === "function") {
      try {
        const parsed = new URL(raw.includes("://") ? raw : `https://${raw.replace(/^\/+/, "")}`);
        return {
          hostname: parsed.hostname,
          pathname: parsed.pathname,
          search: parsed.search
        };
      } catch {
        // Fall back to regex parsing below.
      }
    }

    const match = raw.match(/^(?:https?:\/\/)?([^/?#]+)(\/[^?#]*)?(\?[^#]*)?/i);
    if (!match) {
      return null;
    }

    return {
      hostname: match[1] || "",
      pathname: match[2] || "/",
      search: match[3] || ""
    };
  }

  function normalizeUrl(url) {
    const parsed = parseUrlParts(url);
    if (!parsed) {
      return url || "";
    }

    const keepParams = ["id", "productid", "asin", "item", "sku", "gtin", "article"];
    const params = [];
    const search = parsed.search.replace(/^\?/, "");

    search.split("&").filter(Boolean).forEach((pair) => {
      const [rawKey, rawValue = ""] = pair.split("=");
      const key = decodeURIComponent(rawKey || "");
      if (keepParams.includes(key.toLowerCase())) {
        params.push(`${key}=${decodeURIComponent(rawValue)}`);
      }
    });

    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${params.length ? `?${params.join("&")}` : ""}`;
  }

  function hashString(value) {
    let hash = 2166136261 >>> 0;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    return hash.toString(16).padStart(8, "0");
  }

  function buildPopupProductKey(url, name) {
    return `popup_${hashString(`${normalizeUrl(url)}|${String(name || "").toLowerCase().trim().slice(0, 120)}`)}`;
  }

  function formatSiteName(raw) {
    if (!raw) {
      return "Supported store";
    }

    return String(raw)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      });
  }

  function getHostnameLabel(url) {
    return parseUrlParts(url)?.hostname.replace(/^www\./, "") || "store";
  }

  global.RealDealShared = {
    DEFAULT_SETTINGS,
    STORAGE_KEYS,
    THEME_ICONS,
    SUPPORTED_STORES,
    SUPPORT_LINKS,
    isProductStorageKey,
    getProductEntries,
    getStorageStats,
    getStoredTheme,
    resolveTheme,
    applyTheme,
    toggleTheme,
    currencySymbol,
    formatCurrency,
    roundCurrency,
    clamp,
    normalizeUrl,
    hashString,
    buildPopupProductKey,
    formatSiteName,
    getHostnameLabel
  };
})(globalThis);
