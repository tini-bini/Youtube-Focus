/* global RealDealShared */
if (typeof RealDeal === "undefined") {
  var RealDeal = {};
}

RealDeal.Utils = (function () {
  "use strict";

  const shared = typeof RealDealShared === "object" ? RealDealShared : null;

  const CURRENCY_SYMBOLS = {
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
    CAD: "C$",
    AUD: "A$",
    INR: "\u20B9",
    JPY: "\u00A5",
    RUB: "\u20BD",
    PLN: "PLN ",
    CHF: "CHF "
  };

  function hashString(value) {
    if (shared?.hashString) {
      return shared.hashString(value);
    }

    let hash = 2166136261 >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function normalizeUrl(url) {
    if (shared?.normalizeUrl) {
      return shared.normalizeUrl(url || location.href);
    }

    try {
      const parsed = new URL(url || location.href);
      const keepParams = ["id", "productid", "asin", "item", "sku", "gtin", "article"];
      const params = new URLSearchParams();
      parsed.searchParams.forEach((value, key) => {
        if (keepParams.includes(key.toLowerCase())) {
          params.set(key, value);
        }
      });
      const query = params.toString();
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${query ? `?${query}` : ""}`;
    } catch {
      return url || location.href;
    }
  }

  function getProductId(url, name) {
    const normalized = `${normalizeUrl(url)}|${String(name || "").toLowerCase().trim().slice(0, 120)}`;
    return `rd_p_${hashString(normalized)}`;
  }

  function getSiteName(hostname) {
    const normalizedHost = (hostname || location.hostname).replace(/^www\./, "");
    if (/amazon\./i.test(normalizedHost)) return "amazon";
    if (/walmart\./i.test(normalizedHost)) return "walmart";
    if (/ebay\./i.test(normalizedHost)) return "ebay";
    if (/aliexpress\./i.test(normalizedHost)) return "aliexpress";
    if (/zalando/i.test(normalizedHost)) return "zalando";
    if (/aboutyou|about-you/i.test(normalizedHost)) return "aboutyou";
    if (/zara\./i.test(normalizedHost)) return "zara";
    if (/hm\.com/i.test(normalizedHost)) return "hm";
    if (/otto\./i.test(normalizedHost)) return "otto";
    if (/asos\./i.test(normalizedHost)) return "asos";
    if (/etsy\./i.test(normalizedHost)) return "etsy";
    if (/target\./i.test(normalizedHost)) return "target";
    if (/bestbuy\./i.test(normalizedHost)) return "bestbuy";
    return "generic";
  }

  function parsePrice(raw) {
    if (raw == null) {
      return null;
    }

    let value = String(raw).trim();
    value = value.replace(/[\u20AC$\u00A3\u00A5\u20B9\u20BD\u00A0\u200B]/g, "").trim();
    value = value.replace(/\s*\/\s*(mo|month|year|yr|week|wk).*/i, "");

    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) {
      value = value.replace(/,/g, "");
    } else if (/^\d+,\d{1,2}$/.test(value)) {
      value = value.replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }

    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function detectCurrency(text) {
    const raw = String(text || "");
    if (raw.includes("\u20AC")) return "EUR";
    if (raw.includes("\u00A3")) return "GBP";
    if (/C\$|CA\$/i.test(raw)) return "CAD";
    if (/A\$|AU\$/i.test(raw)) return "AUD";
    if (raw.includes("\u20B9")) return "INR";
    if (raw.includes("\u00A5")) return "JPY";
    if (raw.includes("\u20BD")) return "RUB";
    if (/PLN/i.test(raw)) return "PLN";
    if (raw.includes("Fr") || /CHF/i.test(raw)) return "CHF";
    if (raw.includes("$")) return "USD";
    return "USD";
  }

  function formatPrice(amount, currency) {
    if (amount == null || Number.isNaN(Number(amount))) {
      return "N/A";
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${CURRENCY_SYMBOLS[currency] || `${currency || ""} `}${Number(amount).toFixed(2)}`;
    }
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit"
    });
  }

  function formatDateShort(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  }

  function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.round(days / 30)}mo ago`;
    return `${Math.round(days / 365)}yr ago`;
  }

  function firstText(selectors, root) {
    const searchRoot = root || document;
    for (const selector of selectors) {
      try {
        const element = searchRoot.querySelector(selector);
        if (!element) {
          continue;
        }

        const text = (element.textContent || element.innerText || "").trim();
        if (text) {
          return text;
        }
      } catch {
        // Ignore invalid selectors.
      }
    }
    return null;
  }

  function firstEl(selectors, root) {
    const searchRoot = root || document;
    for (const selector of selectors) {
      try {
        const element = searchRoot.querySelector(selector);
        if (element) {
          return element;
        }
      } catch {
        // Ignore invalid selectors.
      }
    }
    return null;
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function debounce(fn, delay) {
    let timerId = null;
    return function () {
      const args = arguments;
      clearTimeout(timerId);
      timerId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    hashString,
    getProductId,
    normalizeUrl,
    getSiteName,
    parsePrice,
    detectCurrency,
    formatPrice,
    formatDate,
    formatDateShort,
    formatTimeAgo,
    firstText,
    firstEl,
    isVisible,
    debounce,
    clamp
  };
})();
