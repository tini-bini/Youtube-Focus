// RealDeal — eBay Scraper

/* global RealDeal */
RealDeal.ScraperEbay = (function () {
  'use strict';

  class EbayScraper extends RealDeal.ScraperBase {
    constructor() {
      super('ebay');
    }

    canHandle() {
      return /ebay\./i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      const name = this._text([
        'h1.x-item-title__mainTitle span',
        '.x-item-title__mainTitle',
        '#itemTitle span:not(.g-hdn)',
        '#itemTitle',
        'h1[class*="item-title"]',
        '[data-testid="item-title"]'
      ]);

      const { current, original, salePercent, currency } = this._getPricing();
      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return (
        /\/itm\//i.test(location.pathname) ||
        !!document.querySelector('.x-item-title__mainTitle') ||
        !!document.getElementById('itemTitle')
      );
    }

    _getPricing() {
      let currency = 'USD';

      const currentRaw = this._text([
        '.x-price-primary .ux-textspans',
        '#prcIsum',
        '#mm-saleDscPrc',
        '.vi-price .notranslate',
        '[data-testid="x-bin-price"] .ux-textspans',
        '[data-testid="x-buy-it-now-price"] .ux-textspans',
        '.x-buybox .x-price-primary .ux-textspans'
      ]);
      if (currentRaw) currency = this._currency(currentRaw);
      const current = RealDeal.Utils.parsePrice(currentRaw);

      const originalRaw = this._text([
        '.x-additional-info .ux-textspans--STRIKETHROUGH',
        '#orgPrc',
        '.vi-originalPrice .notranslate',
        '.x-price-was .ux-textspans',
        '[data-testid="x-was-price"] .ux-textspans',
        'span[class*="was-price"]',
        'del'
      ]);
      const original = RealDeal.Utils.parsePrice(originalRaw);

      let salePercent = null;
      const discountRaw = this._text([
        '.vi-prc-prc-prcLst-rnk',
        '[class*="savingAmount"]',
        '.x-price-discount .ux-textspans'
      ]);
      if (discountRaw) {
        const m = discountRaw.match(/(\d+)%/);
        if (m) salePercent = parseInt(m[1], 10);
      }
      if (!salePercent && current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      return { current, original, salePercent, currency };
    }
  }

  return new EbayScraper();
})();
