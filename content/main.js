/* global RealDeal */
(function () {
  "use strict";

  if (window.__RealDealRunning) {
    return;
  }
  window.__RealDealRunning = true;

  let lastUrl = location.href;
  let lastProductId = null;
  let currentSettings = null;
  let latestResult = null;
  let analysisPromise = null;
  let queuedRerun = false;
  let queuedOptions = null;

  async function init() {
    currentSettings = await RealDeal.Storage.getSettings();
    RealDeal.Badge._settings = currentSettings;

    bindRuntimeEvents();
    await scheduleAnalysis({ reason: "init" });
    scheduleBootRetries();
  }

  async function scheduleAnalysis(options) {
    if (analysisPromise) {
      queuedRerun = true;
      queuedOptions = options || null;
      return analysisPromise;
    }

    analysisPromise = (async () => {
      let result = null;
      do {
        const nextOptions = queuedOptions || options;
        queuedRerun = false;
        queuedOptions = null;
        result = await analyzePage(nextOptions);
      } while (queuedRerun);
      return result;
    })().finally(() => {
      analysisPromise = null;
    });

    return analysisPromise;
  }

  async function analyzePage(options) {
    const effectiveSettings = options?.settings || currentSettings || await RealDeal.Storage.getSettings();
    currentSettings = effectiveSettings;

    const scraped = RealDeal.Scrapers.scrapeCurrentPage();

    if (!scraped) {
      resetProductState();
      return null;
    }

    const productId = RealDeal.Utils.getProductId(scraped.productUrl || location.href, scraped.name);
    const stored = await RealDeal.Storage.recordPrice(scraped, effectiveSettings);
    const tricks = RealDeal.TrickDetector.detect(scraped, stored, effectiveSettings);
    const scoreResult = RealDeal.TrustScore.calculate(scraped, stored, tricks);

    latestResult = {
      scraped,
      stored,
      scoreResult,
      productId,
      url: location.href,
      analyzedAt: Date.now()
    };

    renderPageUi(latestResult, effectiveSettings);
    lastProductId = productId;

    maybeNotifyTarget(latestResult);

    try {
      chrome.runtime.sendMessage({
        type: "RD_UPDATE_BADGE",
        score: scoreResult.score,
        category: scoreResult.category
      });
    } catch {
      // Extension context may be invalidated on rapid navigation.
    }

    return latestResult;
  }

  function renderPageUi(result, settings) {
    if (settings.showBadge) {
      if (RealDeal.Badge.isInjected() && lastProductId === result.productId) {
        RealDeal.Badge.update(result.scoreResult, result.scraped);
      } else {
        RealDeal.Badge.inject(result.scoreResult, result.scraped);
      }
    } else {
      RealDeal.Badge.remove();
    }

    if (settings.showInlineLabel) {
      RealDeal.Badge.syncInlineLabel(result.scoreResult, result.scraped);
    } else {
      RealDeal.Badge.removeInlineLabel();
    }
  }

  function resetProductState() {
    latestResult = null;
    lastProductId = null;
    RealDeal.Badge.remove();
    RealDeal.Badge.removeInlineLabel();
    RealDeal.SidePanel.close();
    clearExtensionBadge();
  }

  function bindRuntimeEvents() {
    watchPageMutations();
    watchUrlChanges();
    watchSettingsChanges();
    bindKeyboardShortcut();
    bindMessages();
  }

  function watchPageMutations() {
    const debouncedAnalyze = RealDeal.Utils.debounce(() => {
      scheduleAnalysis({ reason: "mutation" }).catch(() => {});
    }, 700);

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        handleNavigation();
        return;
      }

      debouncedAnalyze();
    });

    const target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  function watchUrlChanges() {
    const notifyNavigation = RealDeal.Utils.debounce(() => {
      if (location.href !== lastUrl) {
        handleNavigation();
      }
    }, 120);

    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      history[methodName] = function () {
        const response = original.apply(this, arguments);
        notifyNavigation();
        return response;
      };
    };

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");
    window.addEventListener("popstate", notifyNavigation);
    window.addEventListener("hashchange", notifyNavigation);
  }

  function watchSettingsChanges() {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== "local" || !changes.rd_settings) {
        return;
      }

      currentSettings = await RealDeal.Storage.getSettings();
      RealDeal.Badge._settings = currentSettings;

      if (!currentSettings.showBadge) {
        RealDeal.Badge.remove();
      }

      if (!currentSettings.showInlineLabel) {
        RealDeal.Badge.removeInlineLabel();
      }

      await scheduleAnalysis({ reason: "settings", settings: currentSettings });
    });
  }

  function bindKeyboardShortcut() {
    window.addEventListener("keydown", async (event) => {
      if (!event.altKey || !event.shiftKey || event.key.toLowerCase() !== "d") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();

      const result = await ensureLatestResult();
      if (!result) {
        return;
      }

      RealDeal.SidePanel.toggle(result.scoreResult, result.scraped);
    });
  }

  function bindMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "RD_GET_PAGE_DATA") {
        (async () => {
          sendResponse(await ensureLatestResult());
        })();
        return true;
      }

      if (message.type === "RD_FORCE_ANALYZE") {
        (async () => {
          sendResponse(await scheduleAnalysis({ reason: "popup-refresh", force: true }));
        })();
        return true;
      }

      if (message.type === "RD_OPEN_PANEL") {
        (async () => {
          const result = await ensureLatestResult();
          if (result) {
            RealDeal.SidePanel.open(result.scoreResult, result.scraped);
          }
          sendResponse({ ok: Boolean(result) });
        })();
        return true;
      }

      if (message.type === "RD_TOGGLE_PANEL") {
        (async () => {
          const result = await ensureLatestResult();
          if (result) {
            RealDeal.SidePanel.toggle(result.scoreResult, result.scraped);
          }
          sendResponse({ ok: Boolean(result) });
        })();
        return true;
      }

      return false;
    });
  }

  async function ensureLatestResult() {
    if (latestResult && latestResult.url === location.href) {
      return latestResult;
    }

    return scheduleAnalysis({ reason: "on-demand" });
  }

  function handleNavigation() {
    lastUrl = location.href;
    latestResult = null;
    lastProductId = null;
    RealDeal.Badge.remove();
    RealDeal.Badge.removeInlineLabel();
    RealDeal.SidePanel.close();
    clearExtensionBadge();

    window.setTimeout(() => {
      scheduleAnalysis({ reason: "navigation" }).catch(() => {});
    }, 550);
  }

  function scheduleBootRetries() {
    [900, 1800, 3200, 5200, 7600].forEach((delay) => {
      window.setTimeout(() => {
        scheduleAnalysis({ reason: "boot-retry" }).catch(() => {});
      }, delay);
    });
  }

  function clearExtensionBadge() {
    try {
      chrome.runtime.sendMessage({ type: "RD_CLEAR_BADGE" });
    } catch {
      // Ignore when extension context is being reloaded.
    }
  }

  function maybeNotifyTarget(result) {
    try {
      chrome.runtime.sendMessage({
        type: "RD_MAYBE_NOTIFY_TARGET",
        payload: {
          productId: result.productId,
          productUrl: result.scraped?.productUrl || location.href,
          name: result.scraped?.name || "Tracked product",
          currentPrice: result.scraped?.currentPrice,
          currency: result.scraped?.currency || "USD"
        }
      });
    } catch {
      // Ignore notification failures inside page context.
    }
  }

  function isTypingTarget(target) {
    if (!target) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === "input" || tagName === "textarea" || tagName === "select";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
