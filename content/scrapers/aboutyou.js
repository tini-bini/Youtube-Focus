// RealDeal — About You Scraper
// Covers aboutyou.com, aboutyou.de, aboutyou.at, aboutyou.ch, etc.

/* global RealDeal */
RealDeal.ScraperAboutyou = (function () {
  'use strict';

  class AboutyouScraper extends RealDeal.ScraperBase {
    constructor() {
      super('aboutyou');
    }

    canHandle() {
      return /aboutyou\.|about-you\./i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      // JSON-LD is very reliable on About You
      const fromLd = this._fromJsonLd();
      if (fromLd) return fromLd;

      const name = this._text([
        'h1[class*="name"]',
        'h1[data-testid="product-name"]',
        '[class*="ProductName"]',
        'h1'
      ]);

      const { current, original, salePercent, currency } = this._fromDom();
      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return (
        /\/p\//i.test(location.pathname) ||
        !!document.querySelector('[data-testid="product-name"]') ||
        !!document.querySelector('[class*="ProductDetailPage"]')
      );
    }

    _fromJsonLd() {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const d = JSON.parse(s.textContent);
          if (d['@type'] === 'Product') {
            const offer = Array.isArray(d.offers) ? d.offers[0] : d.offers;
            if (!offer || !d.name) continue;

            const current    = RealDeal.Utils.parsePrice(String(offer.price));
            const currency   = offer.priceCurrency || 'EUR';

            // About You sometimes includes "priceValidUntil" but not old price in LD
            const originalRaw = this._text([
              '[data-testid*="old-price"]',
              '[class*="oldPrice"]',
              '[class*="OldPrice"]',
              '[class*="was-price"]',
              'del', 's'
            ]);
            const original = RealDeal.Utils.parsePrice(originalRaw);

            let salePercent = null;
            if (current && original && original > current) {
              salePercent = Math.round((1 - current / original) * 100);
            }

            return this._build({
              name: d.name,
              currentPrice: current,
              originalPrice: original,
              salePercent,
              currency
            });
          }
        } catch { /* ignore */ }
      }
      return null;
    }

    _fromDom() {
      const currentRaw = this._text([
        '[data-testid="price-current"]',
        '[class*="currentPrice"]',
        '[class*="salePrice"]',
        '[class*="Price__current"]',
        '[itemprop="price"]'
      ]);
      const currency = this._currency(currentRaw || '€');
      const current  = RealDeal.Utils.parsePrice(currentRaw);

      const originalRaw = this._text([
        '[data-testid*="old-price"]',
        '[class*="oldPrice"]',
        '[class*="OldPrice"]',
        'del', 's'
      ]);
      const original = RealDeal.Utils.parsePrice(originalRaw);

      let salePercent = null;
      const badgeRaw = this._text(['[class*="discount"]', '[class*="Discount"]', '[class*="badge"]', '[class*="Badge"]']);
      if (badgeRaw) {
        const m = badgeRaw.match(/-?(\d+)%/);
        if (m) salePercent = parseInt(m[1], 10);
      }
      if (!salePercent && current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      return { current, original, salePercent, currency: currency || 'EUR' };
    }
  }

  return new AboutyouScraper();
})();
