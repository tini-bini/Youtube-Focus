// RealDeal — Storage Layer
// All data stays local via chrome.storage.local. No external requests.

/* global RealDeal */
RealDeal.Storage = (function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    historyDays: 90,
    enableFakeWasDetection: true,
    enablePriceAnchorDetection: true,
    enableUrgencyDetection: true,
    enableRollbackDetection: true,
    enableSubscriptionDetection: true,
    showInlineLabel: true,
    showBadge: true
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  async function getSettings() {
    const data = await chrome.storage.local.get('rd_settings');
    return Object.assign({}, DEFAULT_SETTINGS, data.rd_settings || {});
  }

  async function saveSettings(settings) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, settings);
    await chrome.storage.local.set({ rd_settings: merged });
    return merged;
  }

  // ── Product data ──────────────────────────────────────────────────────────

  async function getProduct(productId) {
    const data = await chrome.storage.local.get(productId);
    return data[productId] || null;
  }

  /**
   * Record a new price observation for a product.
   * Creates the product record if it doesn't exist yet.
   *
   * @param {object} scraped  — output from a scraper
   * @param {object} settings — current user settings
   * @returns {object}        — updated stored product
   */
  async function recordPrice(scraped, settings) {
    if (!scraped || scraped.currentPrice == null) return null;

    const productId = RealDeal.Utils.getProductId(scraped.productUrl || location.href, scraped.name);
    const stored    = (await getProduct(productId)) || createProductRecord(productId, scraped);

    const entry = {
      timestamp:     Date.now(),
      price:         scraped.currentPrice,
      originalPrice: scraped.originalPrice || null,
      salePercent:   scraped.salePercent   || null,
      isSale:        scraped.isOnSale      || false
    };

    // Avoid duplicate entries within 1 hour (e.g. SPA re-render)
    const recentMs = 60 * 60 * 1000;
    const latest   = stored.history[stored.history.length - 1];
    if (latest && (entry.timestamp - latest.timestamp) < recentMs && latest.price === entry.price) {
      return stored; // no-op, nothing changed
    }

    stored.history.push(entry);

    // Prune old entries
    const cutoff = Date.now() - (settings.historyDays || 90) * 86400000;
    stored.history = stored.history.filter(h => h.timestamp >= cutoff);

    // Update aggregate stats
    const prices    = stored.history.map(h => h.price).filter(p => p != null);
    stored.lowestPrice  = prices.length ? Math.min(...prices) : entry.price;
    stored.highestPrice = prices.length ? Math.max(...prices) : entry.price;
    stored.lastUpdated  = Date.now();
    stored.name         = scraped.name || stored.name;
    stored.currency     = scraped.currency || stored.currency;

    await chrome.storage.local.set({ [productId]: stored });
    return stored;
  }

  function createProductRecord(productId, scraped) {
    return {
      productId,
      name:         scraped.name || 'Unknown product',
      site:         scraped.site || 'generic',
      currency:     scraped.currency || 'USD',
      productUrl:   scraped.productUrl || location.href,
      history:      [],
      lowestPrice:  null,
      highestPrice: null,
      lastUpdated:  null
    };
  }

  /** Return all stored product records */
  async function getAllProducts() {
    const data = await chrome.storage.local.get(null);
    return Object.entries(data)
      .filter(([k]) => k.startsWith('rd_p_'))
      .map(([, v]) => v);
  }

  /** Delete all price history and settings */
  async function clearAll() {
    const data = await chrome.storage.local.get(null);
    const keys = Object.keys(data).filter(k => k.startsWith('rd_p_') || k === 'rd_settings');
    if (keys.length) await chrome.storage.local.remove(keys);
  }

  /** Delete price history for a single product */
  async function clearProduct(productId) {
    await chrome.storage.local.remove(productId);
  }

  /** Return total number of stored price observations */
  async function getStats() {
    const products = await getAllProducts();
    const totalObs = products.reduce((acc, p) => acc + (p.history?.length || 0), 0);
    return { productCount: products.length, observationCount: totalObs };
  }

  return {
    getSettings,
    saveSettings,
    getProduct,
    recordPrice,
    getAllProducts,
    clearAll,
    clearProduct,
    getStats
  };
})();
