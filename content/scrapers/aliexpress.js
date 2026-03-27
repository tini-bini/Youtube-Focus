// RealDeal — AliExpress Scraper

/* global RealDeal */
RealDeal.ScraperAliexpress = (function () {
  'use strict';

  class AliexpressScraper extends RealDeal.ScraperBase {
    constructor() {
      super('aliexpress');
    }

    canHandle() {
      return /aliexpress\./i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      // Try JSON-LD first (most reliable on AliExpress)
      const fromLd = this._fromJsonLd();
      if (fromLd) return fromLd;

      const name = this._text([
        'h1[class*="title"]',
        '.product-title',
        'h1.pdp-mod-product-badge-title',
        '[class*="product-name"]',
        'h1'
      ]);

      const { current, original, salePercent, currency } = this._getPricing();
      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return /\/item\//i.test(location.pathname) || !!document.querySelector('[class*="product-title"]');
    }

    _fromJsonLd() {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const d = JSON.parse(s.textContent);
          const arr = Array.isArray(d) ? d : [d];
          for (const item of arr) {
            if (item['@type'] === 'Product' && item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer?.price) {
                return this._build({
                  name:          item.name,
                  currentPrice:  RealDeal.Utils.parsePrice(String(offer.price)),
                  originalPrice: null,
                  currency:      offer.priceCurrency || 'USD'
                });
              }
            }
          }
        } catch { /* ignore */ }
      }
      return null;
    }

    _getPricing() {
      const currentRaw = this._text([
        '.product-price-current',
        '.snow-price_SnowPrice__mainS__18x8np',
        '[class*="price--current"]',
        '[class*="currentPrice"]',
        '.product-price-value',
        'span[class*="Price__current"]'
      ]);
      const currency = this._currency(currentRaw || '');
      const current  = RealDeal.Utils.parsePrice(currentRaw);

      const originalRaw = this._text([
        '.product-price-original',
        '[class*="price--original"]',
        '[class*="originalPrice"]',
        'del'
      ]);
      const original = RealDeal.Utils.parsePrice(originalRaw);

      let salePercent = null;
      const discountRaw = this._text(['[class*="discount"]', '[class*="saving"]']);
      if (discountRaw) {
        const m = discountRaw.match(/(\d+)/);
        if (m) salePercent = parseInt(m[1], 10);
      }

      return { current, original, salePercent, currency };
    }
  }

  return new AliexpressScraper();
})();
