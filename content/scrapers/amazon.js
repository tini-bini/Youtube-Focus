// RealDeal — Amazon Scraper
// Handles amazon.com, amazon.co.uk, amazon.de, amazon.fr, etc.

/* global RealDeal */
RealDeal.ScraperAmazon = (function () {
  'use strict';

  class AmazonScraper extends RealDeal.ScraperBase {
    constructor() {
      super('amazon');
    }

    canHandle() {
      return /amazon\./i.test(location.hostname);
    }

    scrape() {
      // Only run on product detail pages
      if (!this._isProductPage()) return null;

      const name          = this._getName();
      const { current, original, salePercent, currency } = this._getPricing();

      if (!name || current == null) return null;

      return this._build({
        name,
        currentPrice:    current,
        originalPrice:   original,
        salePercent,
        currency,
        isSubscriptionPrice: this._isSubscription()
      });
    }

    _isProductPage() {
      return !!(
        document.getElementById('productTitle') ||
        document.getElementById('dp-container') ||
        document.getElementById('ppd')
      );
    }

    _getName() {
      return this._text([
        '#productTitle',
        '#title span',
        'h1.a-size-large',
        'h1[data-feature-name="title"]',
        'span[id*="productTitle"]'
      ]);
    }

    _getPricing() {
      let currency = 'USD';

      // ── Current price ──────────────────────────────────────────────────

      // Try the "deal" / sale price container first
      let currentRaw = this._text([
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#priceblock_saleprice',
        '.a-price[data-a-color="price"] .a-offscreen',
        '#corePrice_feature_div .a-price .a-offscreen',
        '#apex_offerDisplay_desktop .a-price .a-offscreen',
        '#price_inside_buybox',
        '#newBuyBoxPrice',
        '#tp_price_block_total_price_ww .a-price .a-offscreen',
        '.priceToPay .a-offscreen',
        '.apexPriceToPay .a-offscreen'
      ]);

      // Fallback: first visible .a-price element
      if (!currentRaw) {
        const priceSections = document.querySelectorAll(
          '#ppd .a-price .a-offscreen, #apex_offerDisplay_desktop .a-price .a-offscreen'
        );
        for (const el of priceSections) {
          const t = el.textContent?.trim();
          if (t && RealDeal.Utils.parsePrice(t) != null) {
            currentRaw = t;
            break;
          }
        }
      }

      if (currentRaw) currency = this._currency(currentRaw);
      const current = RealDeal.Utils.parsePrice(currentRaw);

      // ── Original / "was" price ─────────────────────────────────────────

      let originalRaw = this._text([
        '#priceblock_listprice',
        '.basisPrice .a-offscreen',
        '.basisPrice .a-price .a-offscreen',
        '#listPrice',
        '.a-price[data-a-strike="true"] .a-offscreen',
        '.a-text-price .a-offscreen',
        '#ppd .a-price.a-text-price .a-offscreen',
        '[data-feature-name="priceInsideBuyBox"] .a-text-price .a-offscreen',
        '.a-price[data-a-color="secondary"] .a-offscreen'
      ]);

      if (!originalRaw) {
        // Fallback: look for strikethrough elements
        const strikes = document.querySelectorAll(
          '#ppd .a-text-price, #ppd del, #ppd s'
        );
        for (const el of strikes) {
          const t = el.textContent?.trim();
          if (t && RealDeal.Utils.parsePrice(t) != null) {
            originalRaw = t;
            break;
          }
        }
      }

      const original = RealDeal.Utils.parsePrice(originalRaw);

      // ── Sale percentage ────────────────────────────────────────────────

      let salePercent = null;
      const savingsEl = this._text([
        '#savingsPercentage',
        '.savingPriceOverride',
        '[data-feature-name="savingsPercentage"]',
        '.reinventPriceSavingsPercentageMargin'
      ]);
      if (savingsEl) {
        const match = savingsEl.match(/(\d+)/);
        if (match) salePercent = parseInt(match[1], 10);
      } else if (current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      return { current, original, salePercent, currency };
    }

    _isSubscription() {
      const text = (document.body.innerText || '').toLowerCase();
      return (
        /subscribe\s+&\s+save/i.test(text) ||
        /per month|\/month|\/mo\b/i.test(this._text([
          '#priceblock_ourprice', '#corePrice_feature_div', '.priceToPay'
        ]) || '')
      );
    }
  }

  return new AmazonScraper();
})();
