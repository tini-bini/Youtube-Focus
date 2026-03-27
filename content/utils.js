// RealDeal — Utilities
// Shared helpers used by all content script modules.

/* global RealDeal */
if (typeof RealDeal === 'undefined') var RealDeal = {};

RealDeal.Utils = (function () {
  'use strict';

  // ── Hashing ───────────────────────────────────────────────────────────────

  /** FNV-1a 32-bit hash → hex string */
  function hashString(str) {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  function getProductId(url, name) {
    const normalized = normalizeUrl(url) + '|' + (name || '').toLowerCase().trim().slice(0, 120);
    return 'rd_p_' + hashString(normalized);
  }

  // ── URL helpers ───────────────────────────────────────────────────────────

  function normalizeUrl(url) {
    try {
      const u = new URL(url || location.href);
      // Strip query params that are tracking, keep only product-identifying ones
      const keepParams = ['id', 'productid', 'asin', 'item', 'sku', 'gtin', 'article'];
      const kept = new URLSearchParams();
      for (const [k, v] of u.searchParams) {
        if (keepParams.includes(k.toLowerCase())) kept.set(k, v);
      }
      const qs = kept.toString();
      return u.hostname.replace(/^www\./, '') + u.pathname + (qs ? '?' + qs : '');
    } catch {
      return url || location.href;
    }
  }

  function getSiteName(hostname) {
    hostname = (hostname || location.hostname).replace(/^www\./, '');
    if (/amazon\./i.test(hostname))     return 'amazon';
    if (/walmart\./i.test(hostname))    return 'walmart';
    if (/ebay\./i.test(hostname))       return 'ebay';
    if (/aliexpress\./i.test(hostname)) return 'aliexpress';
    if (/zalando/i.test(hostname))      return 'zalando';
    if (/aboutyou|about-you/i.test(hostname)) return 'aboutyou';
    if (/zara\./i.test(hostname))       return 'zara';
    if (/hm\.com/i.test(hostname))      return 'hm';
    if (/otto\./i.test(hostname))       return 'otto';
    if (/asos\./i.test(hostname))       return 'asos';
    if (/etsy\./i.test(hostname))       return 'etsy';
    if (/target\./i.test(hostname))     return 'target';
    if (/bestbuy\./i.test(hostname))    return 'bestbuy';
    return 'generic';
  }

  // ── Price parsing ─────────────────────────────────────────────────────────

  /**
   * Parse a localised price string (handles €, $, £, comma/dot formats).
   * Returns a number or null.
   */
  function parsePrice(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();

    // Strip currency symbols, non-breaking spaces, etc.
    s = s.replace(/[€$£¥₹₽\u00a0\u200b]/g, '').trim();

    // Remove "per month", "/mo", etc. — flag handled separately
    s = s.replace(/\s*\/\s*(mo|month|year|yr|week|wk).*/i, '');

    // European format: 1.234,56 → 1234.56
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    // American format: 1,234.56 → 1234.56
    else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
      s = s.replace(/,/g, '');
    }
    // Simple comma decimal: 1234,56
    else if (/^\d+,\d{1,2}$/.test(s)) {
      s = s.replace(',', '.');
    }
    // Strip remaining commas used as thousands
    else {
      s = s.replace(/,/g, '');
    }

    const n = parseFloat(s);
    return isNaN(n) || n <= 0 ? null : n;
  }

  function detectCurrency(text) {
    if (!text) return 'USD';
    const t = String(text);
    if (t.includes('€'))  return 'EUR';
    if (t.includes('£'))  return 'GBP';
    if (/C\$|CA\$/i.test(t)) return 'CAD';
    if (/A\$|AU\$/i.test(t)) return 'AUD';
    if (t.includes('₹'))  return 'INR';
    if (t.includes('¥'))  return 'JPY';
    if (t.includes('₽'))  return 'RUB';
    if (t.includes('zł') || /PLN/i.test(t)) return 'PLN';
    if (t.includes('kr') || /SEK|DKK|NOK/i.test(t)) return 'SEK';
    if (t.includes('Fr') || /CHF/i.test(t)) return 'CHF';
    if (t.includes('$'))  return 'USD';
    return 'USD';
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$',
    INR: '₹', JPY: '¥', RUB: '₽', PLN: 'zł', CHF: 'Fr'
  };

  function formatPrice(amount, currency) {
    if (amount == null || isNaN(amount)) return 'N/A';
    const sym = CURRENCY_SYMBOLS[currency] || (currency || '') + ' ';
    return sym + amount.toFixed(2);
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  }

  function formatDateShort(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30)  return `${days}d ago`;
    if (days < 365) return `${Math.round(days / 30)}mo ago`;
    return `${Math.round(days / 365)}yr ago`;
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  /** Try a list of CSS selectors, return the first matching element's trimmed text */
  function firstText(selectors, root) {
    root = root || document;
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) {
          const t = (el.textContent || el.innerText || '').trim();
          if (t) return t;
        }
      } catch { /* bad selector */ }
    }
    return null;
  }

  /** Same but returns the element instead of its text */
  function firstEl(selectors, root) {
    root = root || document;
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch { /* bad selector */ }
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  function debounce(fn, delay) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
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
