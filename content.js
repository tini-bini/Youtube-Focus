(() => {
  "use strict";

  const STORAGE_KEY = "ytFocusCleanSettings";
  const ACCOUNT_KEY = "ytFocusCleanAccount";

  const DEFAULT_SETTINGS = {
    hideHomeFeed: true,
    hideShorts: true,
    hideComments: true,
    hideSidebar: true
  };

  const DEFAULT_ACCOUNT = {
    hasPremium: false,
    plan: "free",
    billingCycle: "monthly",
    activatedAt: ""
  };

  const PREMIUM_SETTING_KEYS = ["hideComments", "hideSidebar"];

  const ROOT_CLASS_MAP = {
    hideHomeFeed: "ytfc-hide-home-feed",
    hideShorts: "ytfc-hide-shorts",
    hideComments: "ytfc-hide-comments",
    hideSidebar: "ytfc-hide-sidebar"
  };

  const SHORTS_SURFACE_SELECTORS = [
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-reel-shelf-renderer",
    "ytd-rich-section-renderer ytd-reel-shelf-renderer",
    "ytd-rich-section-renderer[is-shorts]",
    "ytd-reel-video-renderer"
  ];

  const SHORTS_LINK_SELECTORS = [
    "a[href^='/shorts']",
    "a[href*='youtube.com/shorts/']"
  ];

  const SHORTS_CONTAINER_SELECTORS = [
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer",
    "tp-yt-paper-item",
    "ytd-rich-section-renderer",
    "ytd-rich-item-renderer",
    "ytd-grid-video-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-rich-shelf-renderer",
    "ytd-reel-shelf-renderer"
  ];

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    account: { ...DEFAULT_ACCOUNT },
    applyQueued: false,
    lastUrl: window.location.href,
    observer: null,
    urlCheckIntervalId: null
  };

  initialize();

  function initialize() {
    if (window.top !== window.self) {
      return;
    }

    loadStoredState((settings, account) => {
      state.settings = settings;
      state.account = account;
      applyExperience();
      bindEvents();
      startMutationObserver();
      startUrlWatcher();
    });
  }

  function bindEvents() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      let shouldApply = false;

      if (changes[STORAGE_KEY]) {
        state.settings = sanitizeSettings(changes[STORAGE_KEY].newValue);
        shouldApply = true;
      }

      if (changes[ACCOUNT_KEY]) {
        state.account = sanitizeAccount(changes[ACCOUNT_KEY].newValue);
        shouldApply = true;
      }

      if (shouldApply) {
        scheduleApply();
      }
    });

    // YouTube is an SPA, so feature state needs to survive internal route swaps.
    const navigationEvents = [
      "yt-navigate-finish",
      "yt-page-data-updated",
      "spfdone",
      "popstate"
    ];

    navigationEvents.forEach((eventName) => {
      window.addEventListener(eventName, scheduleApply, true);
      document.addEventListener(eventName, scheduleApply, true);
    });
  }

  function startUrlWatcher() {
    if (state.urlCheckIntervalId) {
      return;
    }

    state.urlCheckIntervalId = window.setInterval(() => {
      if (window.location.href !== state.lastUrl) {
        scheduleApply();
      }
    }, 600);
  }

  function startMutationObserver() {
    if (!document.documentElement) {
      return;
    }

    state.observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some(
        (mutation) => mutation.type === "childList" && mutation.addedNodes.length > 0
      );

      if (hasRelevantChange) {
        scheduleApply();
      }
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleApply() {
    if (state.applyQueued) {
      return;
    }

    state.applyQueued = true;

    window.requestAnimationFrame(() => {
      state.applyQueued = false;
      applyExperience();
    });
  }

  function applyExperience() {
    state.lastUrl = window.location.href;

    const effectiveSettings = getEffectiveSettings();

    applyRootClasses(effectiveSettings);
    syncHomeFocusMessage(effectiveSettings);
    syncShortsHiding(effectiveSettings);
  }

  function applyRootClasses(effectiveSettings) {
    const root = document.documentElement;

    Object.entries(ROOT_CLASS_MAP).forEach(([key, className]) => {
      root.classList.toggle(className, Boolean(effectiveSettings[key]));
    });
  }

  function syncHomeFocusMessage(effectiveSettings) {
    const existingMessage = document.getElementById("ytfc-focus-message");

    if (!effectiveSettings.hideHomeFeed || !isHomePage() || !document.body) {
      if (existingMessage) {
        existingMessage.remove();
      }
      return;
    }

    if (!existingMessage) {
      document.body.append(createFocusMessage());
      return;
    }

    if (existingMessage.parentElement !== document.body) {
      document.body.append(existingMessage);
    }
  }

  function syncShortsHiding(effectiveSettings) {
    // Shorts appear in several layouts, so mix direct surface selectors with
    // link-based container hiding to catch sidebar, shelf, and card variants.
    clearManagedShortsHiding();

    if (!effectiveSettings.hideShorts) {
      return;
    }

    SHORTS_SURFACE_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        markElementAsShorts(element);
      });
    });

    SHORTS_LINK_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((link) => {
        const shortsContainer = link.closest(SHORTS_CONTAINER_SELECTORS.join(","));
        markElementAsShorts(shortsContainer || link);
      });
    });
  }

  function clearManagedShortsHiding() {
    document
      .querySelectorAll("[data-ytfc-managed='shorts']")
      .forEach((element) => {
        element.classList.remove("ytfc-managed-hide");
        element.removeAttribute("data-ytfc-managed");
      });
  }

  function markElementAsShorts(element) {
    if (!element || !element.isConnected) {
      return;
    }

    element.dataset.ytfcManaged = "shorts";
    element.classList.add("ytfc-managed-hide");
  }

  function createFocusMessage() {
    // Render the calm state as a fullscreen overlay so it covers the leftover chrome.
    const message = document.createElement("section");
    message.id = "ytfc-focus-message";
    message.setAttribute("role", "status");
    message.innerHTML = `
      <div class="ytfc-focus-shell">
        <div class="ytfc-focus-card">
          <p class="ytfc-focus-eyebrow">YouTube Focus Clean</p>
          <h2 class="ytfc-focus-title">Home is quiet now.</h2>
          <p class="ytfc-focus-copy">
            Search with intention, jump back into a playlist, or open subscriptions
            without getting pulled into the recommendation feed.
          </p>
        </div>
      </div>
    `;

    return message;
  }

  function isHomePage() {
    const { pathname } = window.location;
    return pathname === "/" || pathname === "";
  }

  function loadStoredState(callback) {
    chrome.storage.local.get([STORAGE_KEY, ACCOUNT_KEY], (result) => {
      const settings = sanitizeSettings(result[STORAGE_KEY]);
      const account = sanitizeAccount(result[ACCOUNT_KEY]);
      const nextState = {};

      if (!areSettingsEqual(result[STORAGE_KEY], settings)) {
        nextState[STORAGE_KEY] = settings;
      }

      if (!areAccountsEqual(result[ACCOUNT_KEY], account)) {
        nextState[ACCOUNT_KEY] = account;
      }

      if (Object.keys(nextState).length === 0) {
        callback(settings, account);
        return;
      }

      chrome.storage.local.set(nextState, () => {
        callback(settings, account);
      });
    });
  }

  function sanitizeSettings(rawSettings) {
    const nextSettings = { ...DEFAULT_SETTINGS };

    if (!rawSettings || typeof rawSettings !== "object") {
      return nextSettings;
    }

    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
      if (typeof rawSettings[key] === "boolean") {
        nextSettings[key] = rawSettings[key];
      }
    });

    return nextSettings;
  }

  function sanitizeAccount(rawAccount) {
    const nextAccount = { ...DEFAULT_ACCOUNT };

    if (!rawAccount || typeof rawAccount !== "object") {
      return nextAccount;
    }

    if (typeof rawAccount.hasPremium === "boolean") {
      nextAccount.hasPremium = rawAccount.hasPremium;
    }

    nextAccount.plan = nextAccount.hasPremium ? "premium" : "free";
    nextAccount.billingCycle =
      rawAccount.billingCycle === "monthly" ? rawAccount.billingCycle : DEFAULT_ACCOUNT.billingCycle;
    nextAccount.activatedAt =
      typeof rawAccount.activatedAt === "string" ? rawAccount.activatedAt : "";

    return nextAccount;
  }

  function areSettingsEqual(rawSettings, normalizedSettings) {
    if (!rawSettings || typeof rawSettings !== "object") {
      return false;
    }

    return Object.keys(DEFAULT_SETTINGS).every(
      (key) => rawSettings[key] === normalizedSettings[key]
    );
  }

  function areAccountsEqual(rawAccount, normalizedAccount) {
    if (!rawAccount || typeof rawAccount !== "object") {
      return false;
    }

    return (
      rawAccount.hasPremium === normalizedAccount.hasPremium &&
      rawAccount.plan === normalizedAccount.plan &&
      rawAccount.billingCycle === normalizedAccount.billingCycle &&
      rawAccount.activatedAt === normalizedAccount.activatedAt
    );
  }

  function getEffectiveSettings() {
    const effectiveSettings = { ...state.settings };

    if (!state.account.hasPremium) {
      PREMIUM_SETTING_KEYS.forEach((key) => {
        effectiveSettings[key] = false;
      });
    }

    return effectiveSettings;
  }
})();
