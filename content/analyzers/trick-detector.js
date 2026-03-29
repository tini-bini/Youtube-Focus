/* global RealDeal */
RealDeal.TrickDetector = (function () {
  "use strict";

  function detect(scraped, stored, settings) {
    const tricks = [];
    if (!scraped) {
      return tricks;
    }

    const history = stored?.history || [];

    if (settings.enableFakeWasDetection) {
      checkFakeWas(scraped, history, tricks);
    }
    if (settings.enablePriceAnchorDetection) {
      checkPriceAnchor(scraped, history, tricks);
    }
    if (settings.enableUrgencyDetection) {
      checkUrgency(tricks);
    }
    if (settings.enableRollbackDetection) {
      checkRollback(scraped, history, tricks);
    }
    if (settings.enableSubscriptionDetection) {
      checkSubscription(scraped, tricks);
    }

    return tricks;
  }

  function checkFakeWas(scraped, history, tricks) {
    if (!scraped.isOnSale || history.length < 5) {
      return;
    }

    const saleEntries = history.filter((entry) => entry.isSale).length;
    const ratio = saleEntries / history.length;

    if (ratio >= 0.8) {
      const daysTracked = Math.round((history[history.length - 1].timestamp - history[0].timestamp) / 86400000);
      tricks.push({
        type: "fake_was",
        label: 'Fake "Was" Price',
        description: `This item has shown a sale state for ${Math.round(ratio * 100)}% of the ${daysTracked} tracked days, which can mean the original price is not genuine.`,
        severity: ratio >= 0.95 ? "high" : "medium"
      });
    }
  }

  function checkPriceAnchor(scraped, history, tricks) {
    if (!scraped.originalPrice || history.length < 3) {
      return;
    }

    const highestSeen = Math.max(...history.map((entry) => entry.price).filter((price) => price != null));
    if (!highestSeen || scraped.originalPrice <= highestSeen * 1.4) {
      return;
    }

    const inflated = Math.round((scraped.originalPrice / highestSeen - 1) * 100);
    tricks.push({
      type: "price_anchor",
      label: 'Inflated "Original" Price',
      description: `The listed original price (${RealDeal.Utils.formatPrice(scraped.originalPrice, scraped.currency)}) is ${inflated}% higher than any tracked price, which suggests an artificial anchor.`,
      severity: inflated > 100 ? "high" : "medium"
    });
  }

  function checkUrgency(tricks) {
    const bodyText = document.body?.innerText || "";
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
      /endet\s+in/i,
      /noch\s+\d+/i,
      /se\s+acaba\s+en/i
    ];

    if (countdownEl || urgencyPhrases.some((pattern) => pattern.test(bodyText))) {
      tricks.push({
        type: "urgency",
        label: "Artificial Urgency",
        description: "Countdowns or pressure language were detected on the page. These cues are commonly used to push fast decisions.",
        severity: "low"
      });
    }
  }

  function checkRollback(scraped, history, tricks) {
    if (history.length < 6) {
      return;
    }

    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const now = Date.now();
    const week = 7 * 86400000;
    const recentWindow = sorted.filter((entry) => entry.timestamp >= now - 3 * week && entry.timestamp < now - week);
    const olderWindow = sorted.filter((entry) => entry.timestamp < now - 3 * week);

    if (recentWindow.length < 2 || olderWindow.length < 2) {
      return;
    }

    const windowHigh = Math.max(...recentWindow.map((entry) => entry.price).filter((price) => price != null));
    const olderPrices = olderWindow.map((entry) => entry.price).filter((price) => price != null);
    const olderAverage = olderPrices.reduce((sum, price) => sum + price, 0) / olderPrices.length;

    if (windowHigh > olderAverage * 1.25 && scraped.currentPrice < olderAverage * 1.1) {
      tricks.push({
        type: "rollback",
        label: "Pre-Sale Price Spike",
        description: `Tracked history shows a spike to ${RealDeal.Utils.formatPrice(windowHigh, scraped.currency)} shortly before the current price, which can be used to exaggerate a sale.`,
        severity: "high"
      });
    }
  }

  function checkSubscription(scraped, tricks) {
    if (!scraped.isSubscriptionPrice) {
      const priceAreaText = (document.querySelector('[class*="price"]')?.innerText || "").toLowerCase();
      const patterns = [
        /\/\s*mo\b/,
        /\/\s*month/,
        /per\s+month/,
        /monthly\s+plan/,
        /billed\s+monthly/,
        /\/\s*yr\b/,
        /\/\s*year/,
        /per\s+year/,
        /annual\s+plan/,
        /abonnement/i,
        /monatlich/i
      ];

      if (!patterns.some((pattern) => pattern.test(priceAreaText))) {
        return;
      }
    }

    tricks.push({
      type: "subscription",
      label: "Recurring Price Disguise",
      description: "The displayed amount may be a recurring monthly or annual charge rather than a one-time purchase price.",
      severity: "medium"
    });
  }

  return { detect };
})();
