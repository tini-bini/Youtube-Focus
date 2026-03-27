// RealDeal — Zara Scraper

/* global RealDeal */
RealDeal.ScraperZara = (function () {
  'use strict';

  class ZaraScraper extends RealDeal.ScraperBase {
    constructor() {
      super('zara');
    }

    canHandle() {
      return /zara\.com/i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      const name = this._text([
        'h1.product-detail-info__name',
        'h1[class*="name"]',
        '.product-detail-info__name',
        '[data-qa-action="product-name"]',
        'h1'
      ]);

      const { current, original, salePercent, currency } = this._getPricing();
      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return (
        /\/[a-z]{2}\/[^/]+-p\d+/i.test(location.pathname) ||
        !!document.querySelector('.product-detail-info__name') ||
        !!document.querySelector('[class*="product-detail-info"]')
      );
    }

    _getPricing() {
      const currentRaw = this._text([
        '.price__amount',
        '[class*="price__amount"]',
        '.price-current .price__amount',
        '[data-qa-action="product-price"] .price__amount'
      ]);
      const currency = this._currency(currentRaw || '€');
      const current  = RealDeal.Utils.parsePrice(currentRaw);

      const originalRaw = this._text([
        '.price__amount--on-sale + .price__amount--line-through',
        '[class*="price__amount--line-through"]',
        '[class*="price__original"]',
        'del',
        's'
      ]);
      const original = RealDeal.Utils.parsePrice(originalRaw);

      let salePercent = null;
      if (current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      return { current, original, salePercent, currency: currency || 'EUR' };
    }
  }

  return new ZaraScraper();
})();
