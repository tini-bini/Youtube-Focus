// RealDeal — H&M Scraper

/* global RealDeal */
RealDeal.ScraperHm = (function () {
  'use strict';

  class HmScraper extends RealDeal.ScraperBase {
    constructor() {
      super('hm');
    }

    canHandle() {
      return /hm\.com/i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      const name = this._text([
        'h1.product-detail-main-title',
        'h1[class*="ProductName"]',
        'h1[data-testid="product-name"]',
        '[class*="product-item-headline"]',
        'h1'
      ]);

      const { current, original, salePercent, currency } = this._getPricing();
      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return (
        /\/productpage\.\d+/i.test(location.pathname) ||
        !!document.querySelector('[class*="product-detail"]') ||
        !!document.querySelector('[data-testid="product-name"]')
      );
    }

    _getPricing() {
      const currentRaw = this._text([
        '.price.regular',
        '.price.sale',
        '[class*="price--sale"]',
        '[data-testid="sale-price"]',
        '[data-testid="product-price"]',
        '[class*="ProductPrice"]',
        'p[class*="price"]'
      ]);
      const currency = this._currency(currentRaw || '€');
      const current  = RealDeal.Utils.parsePrice(currentRaw);

      const originalRaw = this._text([
        '.price.regular.line-through',
        '[data-testid="regular-price"]',
        '[class*="price--regular"]',
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

  return new HmScraper();
})();
