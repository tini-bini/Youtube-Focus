// RealDeal — Trust Score Calculator
// Produces a 0–100 score and categorised verdict.

/* global RealDeal */
RealDeal.TrustScore = (function () {
  'use strict';

  /**
   * @typedef {object} ScoreResult
   * @property {number}  score            — 0–100
   * @property {'green'|'yellow'|'red'} category
   * @property {string}  verdict          — one-line human verdict
   * @property {number|null} lowestEverPrice
   * @property {number|null} trueDiscountPct  — actual discount from lowest-ever price
   * @property {number|null} claimedDiscountPct
   * @property {number}  daysAtCurrentPrice
   * @property {number}  daysTracked
   * @property {Array}   history
   */

  /**
   * @param {object}   scraped
   * @param {object}   stored    — may be null if first visit
   * @param {object[]} tricks    — from TrickDetector.detect()
   * @returns {ScoreResult}
   */
  function calculate(scraped, stored, tricks) {
    const history = stored?.history || [];

    const lowestEverPrice  = stored?.lowestPrice ?? scraped.currentPrice;
    const highestEverPrice = stored?.highestPrice ?? scraped.currentPrice;
    const daysTracked      = _daysTracked(history);
    const daysAtCurrentPrice = _daysAtPrice(scraped.currentPrice, history);

    // ── Base score: start at 100, deduct for each bad signal ─────────────

    let score = 100;
    const deductions = [];

    // Deduct per trick severity
    for (const trick of tricks) {
      const cut = { high: 25, medium: 15, low: 8 }[trick.severity] || 10;
      score -= cut;
      deductions.push({ reason: trick.label, points: -cut });
    }

    // Deduct if "sale" price isn't actually a discount vs lowest ever
    const trueDiscountPct = _trueDiscount(scraped.currentPrice, lowestEverPrice, highestEverPrice);
    if (scraped.isOnSale && trueDiscountPct != null && trueDiscountPct < 5) {
      score -= 20;
      deductions.push({ reason: 'Current price matches historical low — no real saving', points: -20 });
    } else if (scraped.isOnSale && trueDiscountPct != null && trueDiscountPct < 15) {
      score -= 10;
      deductions.push({ reason: 'Minimal true discount vs price history', points: -10 });
    }

    // Claimed vs actual discount gap
    if (scraped.salePercent != null && trueDiscountPct != null) {
      const gap = scraped.salePercent - trueDiscountPct;
      if (gap > 40) {
        score -= 20;
        deductions.push({ reason: `Claimed ${scraped.salePercent}% off but true discount is ~${Math.round(trueDiscountPct)}%`, points: -20 });
      } else if (gap > 20) {
        score -= 10;
        deductions.push({ reason: 'Claimed discount overstated vs history', points: -10 });
      }
    }

    // Boost: item genuinely at or near all-time low
    if (trueDiscountPct != null && trueDiscountPct >= 20 && daysTracked > 14) {
      score += 10;
    }

    // Boost: first time we've seen this price this low
    if (scraped.currentPrice != null && scraped.currentPrice <= lowestEverPrice * 1.01 && daysTracked > 7) {
      score += 5;
    }

    score = RealDeal.Utils.clamp(Math.round(score), 0, 100);

    const category = score >= 80 ? 'green' : score >= 40 ? 'yellow' : 'red';
    const verdict  = _buildVerdict(score, category, scraped, tricks, daysAtCurrentPrice, trueDiscountPct, lowestEverPrice);

    return {
      score,
      category,
      verdict,
      lowestEverPrice,
      trueDiscountPct,
      claimedDiscountPct: scraped.salePercent,
      daysAtCurrentPrice,
      daysTracked,
      history,
      tricks,
      deductions
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _daysTracked(history) {
    if (history.length < 2) return 0;
    const sorted = history.slice().sort((a, b) => a.timestamp - b.timestamp);
    return Math.round((sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400000);
  }

  function _daysAtPrice(currentPrice, history) {
    if (!currentPrice || !history.length) return 0;
    const tolerance = currentPrice * 0.02; // 2% tolerance
    const matching  = history.filter(h => Math.abs(h.price - currentPrice) <= tolerance);
    if (matching.length < 2) return matching.length > 0 ? 1 : 0;
    const sorted = matching.slice().sort((a, b) => a.timestamp - b.timestamp);
    return Math.round((sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400000) + 1;
  }

  /**
   * True discount: how much cheaper is the current price vs the highest we've seen?
   * Returns a percentage (0–100) or null if not enough data.
   */
  function _trueDiscount(currentPrice, lowestEver, highestEver) {
    if (currentPrice == null || highestEver == null || highestEver <= currentPrice) return null;
    return Math.round((1 - currentPrice / highestEver) * 100);
  }

  function _buildVerdict(score, category, scraped, tricks, daysAtCurrentPrice, trueDiscountPct, lowestEver) {
    const U = RealDeal.Utils;
    const currency = scraped.currency;

    if (category === 'green') {
      if (trueDiscountPct && trueDiscountPct >= 20) {
        return `Genuine deal — ${trueDiscountPct}% below highest tracked price`;
      }
      if (scraped.currentPrice != null && lowestEver != null && scraped.currentPrice <= lowestEver * 1.01) {
        return `Lowest price seen — ${U.formatPrice(scraped.currentPrice, currency)}`;
      }
      return 'Looks like a legitimate deal';
    }

    if (category === 'red') {
      const topTrick = tricks.find(t => t.severity === 'high') || tricks[0];
      if (topTrick?.type === 'fake_was') {
        return `⚠️ This item has been "on sale" for ${daysAtCurrentPrice} days`;
      }
      if (topTrick?.type === 'rollback') {
        return '⚠️ Price was inflated before this sale — likely fake discount';
      }
      if (topTrick?.type === 'price_anchor') {
        return '⚠️ "Was" price appears fabricated';
      }
      return '⚠️ Multiple fake-sale signals detected';
    }

    // Yellow
    if (daysAtCurrentPrice > 14) {
      return `Questionable — at this price for ${daysAtCurrentPrice}+ days`;
    }
    if (tricks.length > 0) {
      return `Questionable — ${tricks[0].label.toLowerCase()} detected`;
    }
    return 'Questionable deal — limited history available';
  }

  return { calculate };
})();
