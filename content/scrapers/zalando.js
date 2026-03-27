// RealDeal — Zalando Scraper
// Covers all Zalando TLDs including zalando-lounge.

/* global RealDeal */
RealDeal.ScraperZalando = (function () {
  'use strict';

  class ZalandoScraper extends RealDeal.ScraperBase {
    constructor() {
      super('zalando');
    }

    canHandle() {
      return /zalando\./i.test(location.hostname);
    }

    scrape() {
      if (!this._isProductPage()) return null;

      const name = this._text([
        'h1[class*="title"]',
        'span[class*="title"]',
        '[data-testid="pdp-name"]',
        'x-pdp-nameHeading',
        '[itemprop="name"]',
        'h1'
      ]);

      // Try structured data first
      const structured = this._fromStructuredData();
      const { current, original, salePercent, currency } = structured || this._fromDom();

      if (!name || current == null) return null;

      return this._build({ name, currentPrice: current, originalPrice: original, salePercent, currency });
    }

    _isProductPage() {
      return (
        /\/[a-z]{2}\/[^/]+-\w+\.html/i.test(location.pathname) ||
        !!document.querySelector('[data-testid="pdp-name"]') ||
        !!document.querySelector('[class*="x-pdp-pdpWrapper"]')
      );
    }

    _fromStructuredData() {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const d = JSON.parse(s.textContent);
          if (d['@type'] === 'Product') {
            const offer = Array.isArray(d.offers) ? d.offers[0] : d.offers;
            if (!offer) continue;
            const current  = RealDeal.Utils.parsePrice(String(offer.price || ''));
            const currency  = offer.priceCurrency || 'EUR';
            return { current, original: null, salePercent: null, currency };
          }
        } catch { /* ignore */ }
      }
      return null;
    }

    _fromDom() {
      const currentRaw = this._text([
        '[data-testid="pdp-price"]',
        '[class*="price_label"] [class*="amount"]',
        '[class*="Price__Amount"]',
        '[class*="Price__amount"]',
        'span[class*="price_current"]',
        '[data-testid="price"] span'
      ]);
      const currency = this._currency(currentRaw || '€');
      const current  = RealDeal.Utils.parsePrice(currentRaw);

      const originalRaw = this._text([
        '[class*="price_original"]',
        '[class*="PriceInformation__fromPrice"]',
        '[class*="rrp"]',
        'del',
        's'
      ]);
      const original = RealDeal.Utils.parsePrice(originalRaw);

      let salePercent = null;
      const percentRaw = this._text([
        '[class*="discount"]',
        '[class*="Discount"]',
        '[class*="badge"]'
      ]);
      if (percentRaw) {
        const m = percentRaw.match(/-(\d+)%|(\d+)%/);
        if (m) salePercent = parseInt(m[1] || m[2], 10);
      }
      if (!salePercent && current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      return { current, original, salePercent, currency: currency || 'EUR' };
    }
  }

  return new ZalandoScraper();
})();
