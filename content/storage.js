/* global RealDeal, RealDealShared */
RealDeal.Storage = (function () {
  "use strict";

  const DEFAULT_SETTINGS = RealDealShared?.DEFAULT_SETTINGS || {
    historyDays: 90,
    enableFakeWasDetection: true,
    enablePriceAnchorDetection: true,
    enableUrgencyDetection: true,
    enableRollbackDetection: true,
    enableSubscriptionDetection: true,
    showInlineLabel: true,
    showBadge: true
  };

  const STORAGE_KEYS = RealDealShared?.STORAGE_KEYS || {
    settings: "rd_settings",
    productPrefix: "rd_p_"
  };

  async function getSettings() {
    const snapshot = await chrome.storage.local.get(STORAGE_KEYS.settings);
    return {
      ...DEFAULT_SETTINGS,
      ...(snapshot[STORAGE_KEYS.settings] || {})
    };
  }

  async function saveSettings(settings) {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(settings || {})
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: merged });
    return merged;
  }

  async function getProduct(productId) {
    const snapshot = await chrome.storage.local.get(productId);
    return snapshot[productId] || null;
  }

  async function recordPrice(scraped, settings) {
    if (!scraped || scraped.currentPrice == null) {
      return null;
    }

    const productId = RealDeal.Utils.getProductId(scraped.productUrl || location.href, scraped.name);
    const stored = (await getProduct(productId)) || createProductRecord(productId, scraped);
    const entry = {
      timestamp: Date.now(),
      price: scraped.currentPrice,
      originalPrice: scraped.originalPrice || null,
      salePercent: scraped.salePercent || null,
      isSale: scraped.isOnSale || false
    };

    const latest = stored.history[stored.history.length - 1];
    if (latest && entry.timestamp - latest.timestamp < 60 * 60 * 1000 && latest.price === entry.price) {
      stored.lastUpdated = latest.timestamp;
      return stored;
    }

    stored.history.push(entry);
    pruneHistory(stored, settings?.historyDays || DEFAULT_SETTINGS.historyDays);

    const prices = stored.history.map((item) => item.price).filter((price) => price != null);
    stored.lowestPrice = prices.length ? Math.min(...prices) : entry.price;
    stored.highestPrice = prices.length ? Math.max(...prices) : entry.price;
    stored.lastUpdated = Date.now();
    stored.name = scraped.name || stored.name;
    stored.currency = scraped.currency || stored.currency;
    stored.site = scraped.site || stored.site;
    stored.productUrl = scraped.productUrl || stored.productUrl;
    stored.scraperConfidence = scraped.scraperConfidence || stored.scraperConfidence || "high";
    stored.scraperSource = scraped.scraperSource || stored.scraperSource || stored.site;

    await chrome.storage.local.set({ [productId]: stored });
    return stored;
  }

  function createProductRecord(productId, scraped) {
    return {
      productId,
      name: scraped.name || "Unknown product",
      site: scraped.site || "generic",
      currency: scraped.currency || "USD",
      productUrl: scraped.productUrl || location.href,
      history: [],
      lowestPrice: null,
      highestPrice: null,
      lastUpdated: null,
      scraperConfidence: scraped.scraperConfidence || "high",
      scraperSource: scraped.scraperSource || scraped.site || "unknown"
    };
  }

  function pruneHistory(record, historyDays) {
    const cutoff = Date.now() - historyDays * 86400000;
    record.history = record.history.filter((entry) => entry.timestamp >= cutoff);
  }

  async function getAllProducts() {
    const snapshot = await chrome.storage.local.get(null);
    return Object.entries(snapshot)
      .filter(([key]) => key.startsWith(STORAGE_KEYS.productPrefix))
      .map(([, value]) => value);
  }

  async function clearAll() {
    const snapshot = await chrome.storage.local.get(null);
    const keys = Object.keys(snapshot).filter((key) => {
      return key.startsWith(STORAGE_KEYS.productPrefix) || key === STORAGE_KEYS.settings;
    });
    if (keys.length) {
      await chrome.storage.local.remove(keys);
    }
  }

  async function clearProduct(productId) {
    await chrome.storage.local.remove(productId);
  }

  async function getStats() {
    const products = await getAllProducts();
    return {
      productCount: products.length,
      observationCount: products.reduce((total, product) => total + (product.history?.length || 0), 0)
    };
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
