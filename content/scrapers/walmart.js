// RealDeal — Walmart Scraper

/* global RealDeal */
RealDeal.ScraperWalmart = (function () {
  'use strict';

  class WalmartScraper extends RealDeal.ScraperBase {
    constructor() {
      super('walmart');
    }

    canHandle() {
      return /walmart\.com/i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      const name = this._text([
        'h1.prod-ProductTitle',
        '[itemprop="name"]',
        'h1[class*="prod-title"]',
        'h1[class*="ProductTitle"]',
        'h1[data-automation-id="product-title"]',
        '#main-title'
      ]);

      // Walmart React SPA: prices are in JSON-LD or rendered spans
      const { current, original, salePercent, currency } = this._getPricing();

      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return (
        /\/ip\//i.test(location.pathname) ||
        !!document.querySelector('[data-automation-id="product-title"]') ||
        !!document.querySelector('.prod-ProductTitle')
      );
    }

    _getPricing() {
      let currency = 'USD';

      const currentRaw = this._text([
        '[itemprop="price"]',
        '.price-characteristic',
        '[data-automation-id="product-price"] span',
        '.price-group',
        '[class*="price-current"]',
        '[class*="PriceCurrent"]',
        '.prod-PriceSection [class*="price"]'
      ]);
      if (currentRaw) currency = this._currency(currentRaw);
      const current = RealDeal.Utils.parsePrice(currentRaw);

      // Try JSON-LD for structured price
      let originalFromLd = null;
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try {
          const data = JSON.parse(s.textContent);
          const offer = data?.offers || (Array.isArray(data) && data.find(d => d['@type'] === 'Product')?.offers);
          if (offer?.price) {
            // ld+json has the current price — look for "wasPrice"
          }
        } catch { /* ignore */ }
      });

      const originalRaw = this._text([
        '[class*="was-price"]',
        '[class*="WasPrice"]',
        '[class*="strike-through"]',
        '.price-old',
        '[data-automation-id="was-price"]',
        '.prod-PriceSection del',
        'del'
      ]);
      const original = RealDeal.Utils.parsePrice(originalRaw) || originalFromLd;

      let salePercent = null;
      const savingsRaw = this._text([
        '[class*="savings"]',
        '[class*="Savings"]',
        '[class*="rollback"]'
      ]);
      if (savingsRaw) {
        const m = savingsRaw.match(/(\d+)%/);
        if (m) salePercent = parseInt(m[1], 10);
      }
      if (!salePercent && current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      return { current, original, salePercent, currency };
    }
  }

  return new WalmartScraper();
})();
