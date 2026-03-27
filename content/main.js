// RealDeal â€” Main Content Script Orchestrator
// Ties together scraping, storage, analysis, and UI.

/* global RealDeal */
(function () {
  'use strict';

  if (window.__RealDealRunning) return;
  window.__RealDealRunning = true;

  let lastUrl = location.href;
  let lastRunFound = false;
  let lastProductId = null;
  let currentSettings = null;

  async function init() {
    currentSettings = await RealDeal.Storage.getSettings();
    RealDeal.Badge._settings = currentSettings;

    await run(currentSettings);
    _scheduleBootRetries();
    _watchPageChanges();
    _watchSettingsChanges();
  }

  async function run(settings) {
    const effectiveSettings = settings || currentSettings || await RealDeal.Storage.getSettings();
    const scraped = RealDeal.Scrapers.scrapeCurrentPage();

    if (!scraped) {
      lastRunFound = false;
      lastProductId = null;
      RealDeal.Badge.remove();
      RealDeal.SidePanel.close();
      _clearExtensionBadge();
      console.debug('[RealDeal] No product detected on this page yet.');
      return null;
    }

    const productId = RealDeal.Utils.getProductId(scraped.productUrl || location.href, scraped.name);
    const stored = await RealDeal.Storage.recordPrice(scraped, effectiveSettings);
    const tricks = RealDeal.TrickDetector.detect(scraped, stored, effectiveSettings);
    const scoreResult = RealDeal.TrustScore.calculate(scraped, stored, tricks);

    if (effectiveSettings.showBadge) {
      if (RealDeal.Badge.isInjected() && lastProductId === productId) {
        RealDeal.Badge.update(scoreResult, scraped);
      } else {
        RealDeal.Badge.inject(scoreResult, scraped);
      }
    } else {
      RealDeal.Badge.remove();
      RealDeal.SidePanel.close();
    }

    if (effectiveSettings.showInlineLabel) {
      RealDeal.Badge.syncInlineLabel(scoreResult, scraped);
    } else {
      RealDeal.Badge.removeInlineLabel();
    }

    try {
      chrome.runtime.sendMessage({
        type: 'RD_UPDATE_BADGE',
        score: scoreResult.score,
        category: scoreResult.category
      });
    } catch { /* extension context may be invalidated on rapid navigation */ }

    lastRunFound = true;
    lastProductId = productId;
    console.debug('[RealDeal] Score:', scoreResult.score, scoreResult.category, '|', scraped.name);
    return { scraped, stored, scoreResult };
  }

  function _watchPageChanges() {
    const observer = new MutationObserver(RealDeal.Utils.debounce(async () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastRunFound = false;
        lastProductId = null;
        RealDeal.Badge.remove();
        RealDeal.SidePanel.close();
        await _sleep(800);
      }

      const badgeMissing = !!currentSettings?.showBadge && !RealDeal.Badge.isInjected();
      if (!lastRunFound || badgeMissing) {
        await run(currentSettings);
      }
    }, 500));

    const target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  function _scheduleBootRetries() {
    [800, 1600, 3000, 5000, 8000].forEach((delay) => {
      setTimeout(() => {
        run(currentSettings).catch(() => {});
      }, delay);
    });
  }

  function _watchSettingsChanges() {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== 'local' || !changes.rd_settings) return;

      currentSettings = await RealDeal.Storage.getSettings();
      RealDeal.Badge._settings = currentSettings;

      if (!currentSettings.showBadge) {
        RealDeal.Badge.remove();
        RealDeal.SidePanel.close();
      }

      await run(currentSettings);
    });
  }

  function _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function _clearExtensionBadge() {
    try {
      chrome.runtime.sendMessage({ type: 'RD_CLEAR_BADGE' });
    } catch {
      // Extension context may be invalidated during navigation.
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'RD_GET_PAGE_DATA') {
      (async () => {
        const settings = await RealDeal.Storage.getSettings();
        const scraped = RealDeal.Scrapers.scrapeCurrentPage();
        const productId = scraped
          ? RealDeal.Utils.getProductId(scraped.productUrl || location.href, scraped.name)
          : null;
        const stored = productId ? await RealDeal.Storage.getProduct(productId) : null;
        const tricks = scraped ? RealDeal.TrickDetector.detect(scraped, stored, settings) : [];
        const scoreResult = scraped ? RealDeal.TrustScore.calculate(scraped, stored, tricks) : null;

        sendResponse({ scraped, stored, scoreResult });
      })();
      return true;
    }

    if (msg.type === 'RD_OPEN_PANEL') {
      (async () => {
        const settings = await RealDeal.Storage.getSettings();
        const scraped = RealDeal.Scrapers.scrapeCurrentPage();
        const productId = scraped
          ? RealDeal.Utils.getProductId(scraped.productUrl || location.href, scraped.name)
          : null;
        const stored = productId ? await RealDeal.Storage.getProduct(productId) : null;
        const tricks = scraped ? RealDeal.TrickDetector.detect(scraped, stored, settings) : [];
        const scoreResult = scraped ? RealDeal.TrustScore.calculate(scraped, stored, tricks) : null;
        if (scoreResult) RealDeal.SidePanel.open(scoreResult, scraped);
        sendResponse({ ok: true });
      })();
      return true;
    }

    return false;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
