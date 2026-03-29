// RealDeal - Generic fallback scraper
// Tries structured data, meta tags, and broad DOM heuristics for modern storefronts.

/* global RealDeal */
RealDeal.ScraperGeneric = (function () {
  'use strict';

  class GenericScraper extends RealDeal.ScraperBase {
    constructor() {
      super('generic');
    }

    canHandle() {
      return true;
    }

    scrape() {
      const fromLd = this._fromJsonLd();
      if (fromLd && fromLd.currentPrice != null && fromLd.name) return fromLd;

      const fromMeta = this._fromMetaTags();
      if (fromMeta && fromMeta.currentPrice != null && fromMeta.name) return fromMeta;

      const fromMicro = this._fromMicrodata();
      if (fromMicro && fromMicro.currentPrice != null && fromMicro.name) return fromMicro;

      return this._fromDom();
    }

    _fromJsonLd() {
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const data = JSON.parse(script.textContent);
          const products = this._collectProductNodes(data);

          for (const product of products) {
            const offer = this._extractOffer(product);
            const current = RealDeal.Utils.parsePrice(String(
              offer?.price ??
              offer?.lowPrice ??
              product.price ??
              product.lowPrice ??
              ''
            ));
            if (current == null) continue;

            const currency = offer?.priceCurrency || product.priceCurrency || this._currency('');
            const originalFromLd = RealDeal.Utils.parsePrice(String(
              offer?.highPrice ??
              offer?.priceSpecification?.price ??
              product.highPrice ??
              ''
            ));
            const originalFromDom = RealDeal.Utils.parsePrice(this._findPriceText(ORIGINAL_PRICE_SELECTORS));
            const original = originalFromLd && originalFromLd > current ? originalFromLd : originalFromDom;

            return this._build({
              name: product.name || product.title || product.headline || this._text(NAME_SELECTORS),
              currentPrice: current,
              originalPrice: original,
              currency,
              scraperConfidence: 'medium',
              scraperSource: 'JSON-LD fallback'
            });
          }
        } catch { /* ignore invalid JSON-LD */ }
      }
      return null;
    }

    _fromMetaTags() {
      const currentRaw =
        document.querySelector('meta[property="product:price:amount"]')?.content ||
        document.querySelector('meta[property="og:price:amount"]')?.content ||
        document.querySelector('meta[itemprop="price"]')?.content ||
        document.querySelector('meta[name="price"]')?.content;
      const current = RealDeal.Utils.parsePrice(currentRaw);
      if (current == null) return null;

      const currency =
        document.querySelector('meta[property="product:price:currency"]')?.content ||
        document.querySelector('meta[property="og:price:currency"]')?.content ||
        document.querySelector('meta[itemprop="priceCurrency"]')?.content ||
        this._currency(currentRaw || '');

      const name =
        document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector('meta[name="twitter:title"]')?.content ||
        this._text(NAME_SELECTORS);

      const original = RealDeal.Utils.parsePrice(this._findPriceText(ORIGINAL_PRICE_SELECTORS));

      return this._build({
        name,
        currentPrice: current,
        originalPrice: original,
        currency,
        scraperConfidence: 'medium',
        scraperSource: 'Meta tags fallback'
      });
    }

    _fromMicrodata() {
      const nameEl = document.querySelector('[itemprop="name"]');
      const priceEl = document.querySelector('[itemprop="price"]');
      const currencyEl = document.querySelector('[itemprop="priceCurrency"]');
      if (!priceEl) return null;

      const priceAttr = priceEl.getAttribute('content') || priceEl.textContent;
      const current = RealDeal.Utils.parsePrice(priceAttr);
      if (current == null) return null;

      const currency = currencyEl?.getAttribute('content') || this._currency(priceAttr || '');
      const original = RealDeal.Utils.parsePrice(this._findPriceText(ORIGINAL_PRICE_SELECTORS));

      return this._build({
        name: nameEl?.getAttribute('content') || nameEl?.textContent || this._text(NAME_SELECTORS),
        currentPrice: current,
        originalPrice: original,
        currency,
        scraperConfidence: 'medium',
        scraperSource: 'Microdata fallback'
      });
    }

    _fromDom() {
      const name = this._text(NAME_SELECTORS);
      const currentRaw = this._findPriceText(CURRENT_PRICE_SELECTORS);
      if (!name || !currentRaw) return null;

      const currency = this._currency(currentRaw);
      const current = RealDeal.Utils.parsePrice(currentRaw);
      if (current == null) return null;

      const originalRaw = this._findPriceText(ORIGINAL_PRICE_SELECTORS);
      const original = RealDeal.Utils.parsePrice(originalRaw);

      let salePercent = null;
      const discountRaw = this._text(DISCOUNT_SELECTORS);
      if (discountRaw) {
        const match = discountRaw.match(/-?(\d+)%/);
        if (match) salePercent = parseInt(match[1], 10);
      }
      if (!salePercent && current && original && original > current) {
        salePercent = Math.round((1 - current / original) * 100);
      }

      const isSubscriptionPrice = /per\s+month|\/mo\b|\/month|per\s+year|\/yr\b/i.test(
        (document.body?.innerText || '').slice(0, 6000)
      );

      return this._build({
        name,
        currentPrice: current,
        originalPrice: original,
        salePercent,
        currency,
        isSubscriptionPrice,
        scraperConfidence: 'low',
        scraperSource: 'DOM fallback'
      });
    }

    _findPriceText(selectors) {
      const candidates = [];

      for (const selector of selectors) {
        let elements = [];
        try {
          elements = Array.from(document.querySelectorAll(selector));
        } catch {
          continue;
        }

        for (const el of elements) {
          const raw = this._extractElementPriceText(el);
          const price = RealDeal.Utils.parsePrice(raw);
          if (price == null) continue;

          candidates.push({
            raw,
            price,
            score: this._scorePriceElement(el, raw)
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score || a.price - b.price);
      return candidates[0]?.raw || null;
    }

    _extractElementPriceText(el) {
      if (!el) return null;

      const attrs = ['content', 'data-price', 'data-price-amount', 'data-sale-price', 'data-current-price', 'data-product-price', 'aria-label'];
      for (const attr of attrs) {
        const value = el.getAttribute?.(attr);
        if (value && RealDeal.Utils.parsePrice(value) != null) return value;
      }

      const nestedValues = [
        el.textContent,
        el.innerText,
        el.querySelector?.('[content]')?.getAttribute('content'),
        el.querySelector?.('[data-price]')?.getAttribute('data-price'),
        el.querySelector?.('[data-price-amount]')?.getAttribute('data-price-amount')
      ];

      return nestedValues.find(value => value && RealDeal.Utils.parsePrice(value) != null) || null;
    }

    _scorePriceElement(el, raw) {
      let score = 0;
      const text = `${el.className || ''} ${el.id || ''} ${raw || ''}`.toLowerCase();

      if (RealDeal.Utils.isVisible(el)) score += 4;
      if (text.includes('current') || text.includes('sale') || text.includes('final')) score += 4;
      if (text.includes('price')) score += 3;
      if (text.includes('old') || text.includes('original') || text.includes('compare') || text.includes('regular')) score -= 6;
      if (el.tagName === 'DEL' || el.tagName === 'S' || el.tagName === 'STRIKE') score -= 8;

      return score;
    }

    _collectProductNodes(root) {
      const results = [];

      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }

        const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : node['@type'];
        if (typeof type === 'string' && /product/i.test(type)) {
          results.push(node);
        }

        Object.values(node).forEach(visit);
      };

      visit(root);
      return results;
    }

    _extractOffer(product) {
      const rawOffer = product?.offers || product?.offer || product?.aggregateOffer;
      if (Array.isArray(rawOffer)) return rawOffer[0] || null;
      if (rawOffer && typeof rawOffer === 'object') return rawOffer;
      return null;
    }
  }

  const NAME_SELECTORS = [
    'h1[data-testid*="name"]',
    'h1[data-testid*="title"]',
    '[data-testid*="product-name"]',
    '[data-testid*="product-title"]',
    'h1[class*="product"]',
    'h1[class*="title"]',
    '[class*="product-name"]',
    '[class*="product-title"]',
    '[class*="ProductName"]',
    '[class*="ProductTitle"]',
    '[class*="item-title"]',
    'h1'
  ];

  const CURRENT_PRICE_SELECTORS = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    '[data-testid="price-current"]',
    '[data-testid="sale-price"]',
    '[data-testid="price"]',
    '[data-testid*="price"]',
    '[data-test-id*="price"]',
    '[data-qa-action*="price"]',
    '[data-price-amount]',
    '[data-current-price]',
    '[data-product-price]',
    '[class*="sale-price"]',
    '[class*="salePrice"]',
    '[class*="SalePrice"]',
    '[class*="current-price"]',
    '[class*="currentPrice"]',
    '[class*="CurrentPrice"]',
    '[class*="final-price"]',
    '[class*="finalPrice"]',
    '[class*="Price__current"]',
    '[class*="price--sale"]',
    '[class*="price--current"]',
    '[class*="product-price"]',
    '[class*="ProductPrice"]',
    '[class*="money"]',
    '[class*="Money"]',
    '[class*="amount"]',
    '[data-price]',
    '.price ins',
    '.price .amount',
    'span.price',
    'p.price'
  ];

  const ORIGINAL_PRICE_SELECTORS = [
    'del',
    's',
    'strike',
    '[data-testid*="old-price"]',
    '[data-testid*="original-price"]',
    '[data-testid*="regular-price"]',
    '[class*="original-price"]',
    '[class*="originalPrice"]',
    '[class*="OriginalPrice"]',
    '[class*="was-price"]',
    '[class*="wasPrice"]',
    '[class*="WasPrice"]',
    '[class*="price--original"]',
    '[class*="list-price"]',
    '[class*="listPrice"]',
    '[class*="compare-price"]',
    '[class*="comparePrice"]',
    '[class*="regular-price"]',
    '[class*="regularPrice"]',
    '[class*="rrp"]',
    '[class*="msrp"]',
    '.price del',
    '.price s'
  ];

  const DISCOUNT_SELECTORS = [
    '[class*="discount"]',
    '[class*="Discount"]',
    '[class*="savings"]',
    '[class*="save"]',
    '[class*="badge"]',
    '[class*="tag"]'
  ];

  return new GenericScraper();
})();
