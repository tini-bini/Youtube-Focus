// RealDeal — Base Scraper
// All site scrapers extend this interface.

/* global RealDeal */
RealDeal.ScraperBase = (function () {
  'use strict';

  /**
   * @typedef {object} ScrapedProduct
   * @property {string}       name
   * @property {number|null}  currentPrice
   * @property {number|null}  originalPrice  — the "was" / crossed-out price
   * @property {number|null}  salePercent    — claimed sale % (from page)
   * @property {string}       currency
   * @property {boolean}      isOnSale
   * @property {string}       productUrl     — normalised canonical URL
   * @property {string}       site
   * @property {boolean}      isSubscriptionPrice — price shown is per-month/recurring
   */

  class BaseScraper {
    constructor(name) {
      this.name = name;
    }

    /** Return true if this scraper handles the current page */
    canHandle() {
      return false;
    }

    /** Scrape the page and return a ScrapedProduct or null */
    scrape() {
      return null;
    }

    // ── Shared helpers used by all scrapers ──────────────────────────────

    _text(selectors, root) {
      return RealDeal.Utils.firstText(
        Array.isArray(selectors) ? selectors : [selectors],
        root || document
      );
    }

    _el(selectors, root) {
      return RealDeal.Utils.firstEl(
        Array.isArray(selectors) ? selectors : [selectors],
        root || document
      );
    }

    _price(selectors, root) {
      const raw = this._text(selectors, root);
      return raw ? RealDeal.Utils.parsePrice(raw) : null;
    }

    _currency(raw) {
      return RealDeal.Utils.detectCurrency(raw || document.documentElement.lang || navigator.language);
    }

    _url() {
      return RealDeal.Utils.normalizeUrl(
        document.querySelector('link[rel="canonical"]')?.href || location.href
      );
    }

    /** Build a valid ScrapedProduct, filling safe defaults */
    _build({
      name,
      currentPrice,
      originalPrice,
      salePercent,
      currency,
      isSubscriptionPrice,
      scraperConfidence,
      scraperSource
    }) {
      const isOnSale = (originalPrice != null && originalPrice > (currentPrice || 0))
        || (salePercent != null && salePercent > 0);

      return {
        name:                (name || '').trim().slice(0, 250) || null,
        currentPrice:        currentPrice  != null ? +currentPrice.toFixed(2)  : null,
        originalPrice:       originalPrice != null ? +originalPrice.toFixed(2) : null,
        salePercent:         salePercent   != null ? Math.round(salePercent)   : null,
        currency:            currency || 'USD',
        isOnSale:            !!isOnSale,
        isSubscriptionPrice: !!isSubscriptionPrice,
        productUrl:          this._url(),
        site:                this.name,
        scraperConfidence:   scraperConfidence || 'high',
        scraperSource:       scraperSource || this.name
      };
    }
  }

  return BaseScraper;
})();
