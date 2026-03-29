/* global RealDeal */
RealDeal.TrustScore = (function () {
  "use strict";

  function calculate(scraped, stored, tricks) {
    const history = stored?.history || [];
    const lowestEverPrice = stored?.lowestPrice ?? scraped.currentPrice;
    const highestEverPrice = stored?.highestPrice ?? scraped.currentPrice;
    const daysTracked = getDaysTracked(history);
    const daysAtCurrentPrice = getDaysAtPrice(scraped.currentPrice, history);

    let score = 100;
    const deductions = [];

    tricks.forEach((trick) => {
      const points = { high: 25, medium: 15, low: 8 }[trick.severity] || 10;
      score -= points;
      deductions.push({ reason: trick.label, points: -points });
    });

    const trueDiscountPct = getTrueDiscount(scraped.currentPrice, highestEverPrice);

    if (scraped.isOnSale && trueDiscountPct != null && trueDiscountPct < 5) {
      score -= 20;
      deductions.push({ reason: "Current price is not meaningfully below tracked highs", points: -20 });
    } else if (scraped.isOnSale && trueDiscountPct != null && trueDiscountPct < 15) {
      score -= 10;
      deductions.push({ reason: "The real discount is modest compared with tracked history", points: -10 });
    }

    if (scraped.salePercent != null && trueDiscountPct != null) {
      const gap = scraped.salePercent - trueDiscountPct;
      if (gap > 40) {
        score -= 20;
        deductions.push({ reason: `Claimed ${scraped.salePercent}% off but history suggests about ${Math.round(trueDiscountPct)}%`, points: -20 });
      } else if (gap > 20) {
        score -= 10;
        deductions.push({ reason: "Claimed discount looks overstated versus tracked history", points: -10 });
      }
    }

    if (trueDiscountPct != null && trueDiscountPct >= 20 && daysTracked > 14) {
      score += 10;
    }

    if (scraped.currentPrice != null && scraped.currentPrice <= lowestEverPrice * 1.01 && daysTracked > 7) {
      score += 5;
    }

    score = RealDeal.Utils.clamp(Math.round(score), 0, 100);

    const category = score >= 80 ? "green" : score >= 40 ? "yellow" : "red";
    const verdict = buildVerdict({
      score,
      category,
      scraped,
      tricks,
      daysAtCurrentPrice,
      trueDiscountPct,
      lowestEverPrice
    });

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

  function getDaysTracked(history) {
    if (history.length < 2) {
      return 0;
    }

    const sorted = history.slice().sort((a, b) => a.timestamp - b.timestamp);
    return Math.round((sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400000);
  }

  function getDaysAtPrice(currentPrice, history) {
    if (!currentPrice || !history.length) {
      return 0;
    }

    const tolerance = currentPrice * 0.02;
    const matching = history.filter((entry) => Math.abs(entry.price - currentPrice) <= tolerance);
    if (matching.length < 2) {
      return matching.length ? 1 : 0;
    }

    const sorted = matching.slice().sort((a, b) => a.timestamp - b.timestamp);
    return Math.round((sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400000) + 1;
  }

  function getTrueDiscount(currentPrice, highestEverPrice) {
    if (currentPrice == null || highestEverPrice == null || highestEverPrice <= currentPrice) {
      return null;
    }

    return Math.round((1 - currentPrice / highestEverPrice) * 100);
  }

  function buildVerdict({ category, scraped, tricks, daysAtCurrentPrice, trueDiscountPct, lowestEverPrice }) {
    const formatPrice = RealDeal.Utils.formatPrice;
    const currency = scraped.currency;

    if (category === "green") {
      if (trueDiscountPct != null && trueDiscountPct >= 20) {
        return `Looks strong: about ${trueDiscountPct}% below the highest tracked price.`;
      }

      if (scraped.currentPrice != null && lowestEverPrice != null && scraped.currentPrice <= lowestEverPrice * 1.01) {
        return `Matching the lowest tracked price at ${formatPrice(scraped.currentPrice, currency)}.`;
      }

      return "This looks like a legitimate deal based on tracked history.";
    }

    if (category === "red") {
      const topTrick = tricks.find((trick) => trick.severity === "high") || tricks[0];
      if (topTrick?.type === "fake_was") {
        return `High risk: this product has looked on sale for about ${daysAtCurrentPrice} days.`;
      }
      if (topTrick?.type === "rollback") {
        return "High risk: tracked prices suggest the sale may have been staged after a temporary spike.";
      }
      if (topTrick?.type === "price_anchor") {
        return 'High risk: the listed "original" price does not line up with tracked history.';
      }
      return "High risk: multiple fake-sale signals were detected.";
    }

    if (daysAtCurrentPrice > 14) {
      return `Needs context: the product has been around this price for ${daysAtCurrentPrice}+ days.`;
    }
    if (tricks.length > 0) {
      return `Needs context: ${tricks[0].label.toLowerCase()} was detected.`;
    }
    return "Needs context: there is not enough history yet to verify the deal confidently.";
  }

  return { calculate };
})();
