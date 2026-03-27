// RealDeal — Retailer Trick Detector
// Analyses price history and DOM to flag known deceptive pricing tactics.

/* global RealDeal */
RealDeal.TrickDetector = (function () {
  'use strict';

  /**
   * @typedef {object} Trick
   * @property {string} type        — machine-readable ID
   * @property {string} label       — short human label
   * @property {string} description — one-sentence explanation
   * @property {'low'|'medium'|'high'} severity
   */

  /**
   * Detect all tricks for the given product.
   *
   * @param {object} scraped  — ScrapedProduct from a scraper
   * @param {object} stored   — stored product record (may be null)
   * @param {object} settings — user settings
   * @returns {Trick[]}
   */
  function detect(scraped, stored, settings) {
    const tricks = [];

    if (!scraped) return tricks;

    const history = stored?.history || [];

    if (settings.enableFakeWasDetection)      _checkFakeWas(scraped, history, tricks);
    if (settings.enablePriceAnchorDetection)   _checkPriceAnchor(scraped, history, tricks);
    if (settings.enableUrgencyDetection)       _checkUrgency(tricks);
    if (settings.enableRollbackDetection)      _checkRollback(scraped, history, tricks);
    if (settings.enableSubscriptionDetection)  _checkSubscription(scraped, tricks);

    return tricks;
  }

  // ── Individual checks ─────────────────────────────────────────────────────

  /**
   * Fake "Was" price:
   * The item has been at the current "sale" price for >80% of tracked history.
   */
  function _checkFakeWas(scraped, history, tricks) {
    if (!scraped.isOnSale || history.length < 5) return;

    const saleEntries = history.filter(h => h.isSale).length;
    const ratio       = saleEntries / history.length;

    if (ratio >= 0.8) {
      const pct  = Math.round(ratio * 100);
      const days = Math.round(
        (history[history.length - 1].timestamp - history[0].timestamp) / 86400000
      );
      tricks.push({
        type:        'fake_was',
        label:       'Fake "Was" Price',
        description: `This item has been listed as "on sale" for ${pct}% of the ${days} days tracked — the original price may be fabricated.`,
        severity:    ratio >= 0.95 ? 'high' : 'medium'
      });
    }
  }

  /**
   * Price Anchoring:
   * The "original" price is significantly higher than the highest price ever recorded.
   */
  function _checkPriceAnchor(scraped, history, tricks) {
    if (!scraped.originalPrice || history.length < 3) return;

    const prices      = history.map(h => h.price).filter(p => p != null);
    const highestSeen = prices.length ? Math.max(...prices) : null;

    if (!highestSeen) return;

    // If the listed original is >40% above any price we ever saw
    if (scraped.originalPrice > highestSeen * 1.4) {
      const inflated = Math.round((scraped.originalPrice / highestSeen - 1) * 100);
      tricks.push({
        type:        'price_anchor',
        label:       'Inflated "Original" Price',
        description: `The listed "was" price (${RealDeal.Utils.formatPrice(scraped.originalPrice, scraped.currency)}) is ${inflated}% higher than any price ever recorded — this may be an artificial anchor.`,
        severity:    inflated > 100 ? 'high' : 'medium'
      });
    }
  }

  /**
   * Artificial Urgency:
   * Detect countdown timers, "Only X left!", and "Sale ends in…" on the page.
   */
  function _checkUrgency(tricks) {
    const body = document.body.innerText || '';

    const countdownEl = document.querySelector(
      '[class*="countdown"], [class*="timer"], [id*="countdown"], [id*="timer"], [class*="TimeLeft"]'
    );

    const urgencyPhrases = [
      /only\s+\d+\s+left/i,
      /\d+\s+left\s+in\s+stock/i,
      /sale\s+ends\s+in/i,
      /deal\s+ends\s+in/i,
      /offer\s+ends\s+in/i,
      /limited\s+time\s+offer/i,
      /hurry[,!\s]/i,
      /selling\s+fast/i,
      /almost\s+gone/i,
      /\d+\s+watching/i,
      /endet\s+in/i,    // German
      /noch\s+\d+/i,    // German "only X left"
      /se\s+acaba\s+en/i  // Spanish
    ];

    const hasUrgencyText = urgencyPhrases.some(re => re.test(body));

    if (countdownEl || hasUrgencyText) {
      const label = countdownEl ? 'Countdown timer' : 'Urgency language';
      tricks.push({
        type:        'urgency',
        label:       'Artificial Urgency',
        description: `${label} detected — retailers use urgency cues to pressure fast decisions without research.`,
        severity:    'low'
      });
    }
  }

  /**
   * Rollback trick:
   * Price was artificially raised 1–3 weeks before a "sale" to inflate the discount.
   * Look for a spike in history right before the current low price.
   */
  function _checkRollback(scraped, history, tricks) {
    if (history.length < 6) return;

    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const now    = Date.now();
    const week   = 7 * 86400000;

    // Entries from 21–7 days ago
    const recentWindow = sorted.filter(
      h => h.timestamp >= now - 3 * week && h.timestamp < now - week
    );

    if (recentWindow.length < 2) return;

    const windowPrices = recentWindow.map(h => h.price).filter(p => p != null);
    const windowHigh   = Math.max(...windowPrices);

    // Entries older than 3 weeks
    const olderWindow  = sorted.filter(h => h.timestamp < now - 3 * week);
    if (olderWindow.length < 2) return;

    const olderPrices  = olderWindow.map(h => h.price).filter(p => p != null);
    const olderAvg     = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;

    // If recent window has a spike >25% above historical average → rollback
    if (windowHigh > olderAvg * 1.25 && scraped.currentPrice < olderAvg * 1.1) {
      tricks.push({
        type:        'rollback',
        label:       'Pre-Sale Price Spike',
        description: `The price spiked to ${RealDeal.Utils.formatPrice(windowHigh, scraped.currency)} 1–3 weeks ago (up ${Math.round((windowHigh / olderAvg - 1) * 100)}% from normal) — a classic trick to inflate the apparent discount.`,
        severity:    'high'
      });
    }
  }

  /**
   * Subscription price disguise:
   * The displayed price is a recurring/monthly charge but styled like a one-time price.
   */
  function _checkSubscription(scraped, tricks) {
    if (!scraped.isSubscriptionPrice) {
      // Re-check DOM for subtle cues
      const priceAreaText = (
        document.querySelector('[class*="price"]')?.innerText || ''
      ).toLowerCase();

      const subscriptionPhrases = [
        /\/\s*mo\b/, /\/\s*month/, /per\s+month/, /monthly\s+plan/, /billed\s+monthly/,
        /\/\s*yr\b/, /\/\s*year/, /per\s+year/, /annual\s+plan/,
        /abonnement/i, /monatlich/i  // French / German
      ];

      const found = subscriptionPhrases.some(re => re.test(priceAreaText));
      if (!found) return;
    }

    tricks.push({
      type:        'subscription',
      label:       'Recurring Price Disguise',
      description: 'The displayed price may be a recurring monthly/annual charge — make sure you\'re not signing up for a subscription.',
      severity:    'medium'
    });
  }

  return { detect };
})();
