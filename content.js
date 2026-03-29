(() => {
  "use strict";

  const {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    DEFAULT_ACCOUNT,
    DEFAULT_POPUP_STATE,
    DEFAULT_SESSION_STATE,
    DEFAULT_AUTOMATION_STATE,
    DEFAULT_ALLOWLIST_STATE,
    DEFAULT_ANALYTICS_STATE,
    storageGet,
    storageSet,
    sanitizeSettings,
    sanitizeAccount,
    sanitizePopupState,
    sanitizeSessionState,
    sanitizeAutomationState,
    sanitizeAllowlistState,
    sanitizeAnalyticsState,
    normalizeStoredState,
    getEffectiveSettings,
    countActiveShields,
    resolveActiveProfile,
    PROFILE_META,
    isWithinSchedule,
    urlMatchesAllowlist,
    bumpAnalytics
  } = YTFCShared;

  const ROOT_CLASS_MAP = Object.freeze({
    hideHomeFeed: "ytfc-hide-home-feed",
    hideShorts: "ytfc-hide-shorts",
    hideComments: "ytfc-hide-comments",
    hideSidebar: "ytfc-hide-sidebar",
    hideExplore: "ytfc-hide-explore",
    hideNotifications: "ytfc-hide-notifications",
    hideTopicChips: "ytfc-hide-topic-chips"
  });

  const SHORTS_SURFACE_SELECTORS = Object.freeze([
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-reel-shelf-renderer",
    "ytd-rich-section-renderer ytd-reel-shelf-renderer",
    "ytd-rich-section-renderer[is-shorts]",
    "ytd-reel-video-renderer",
    "ytd-rich-grid-slim-media[is-short]"
  ]);

  const SHORTS_LINK_SELECTORS = Object.freeze([
    "a[href^='/shorts']",
    "a[href*='youtube.com/shorts/']"
  ]);

  const SHORTS_CONTAINER_SELECTORS = Object.freeze([
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
  ]);

  const LOCATION_CHANGE_EVENT = "ytfc-location-change";

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    account: { ...DEFAULT_ACCOUNT },
    popupState: { ...DEFAULT_POPUP_STATE },
    session: { ...DEFAULT_SESSION_STATE },
    automation: { ...DEFAULT_AUTOMATION_STATE },
    allowlist: { ...DEFAULT_ALLOWLIST_STATE },
    analytics: { ...DEFAULT_ANALYTICS_STATE },
    observer: null,
    managedShortsElements: new Set(),
    applyTimeoutId: 0,
    lastProtectedUrl: "",
    lastAllowlistedUrl: ""
  };

  initialize();

  async function initialize() {
    if (window.top !== window.self) {
      return;
    }

    try {
      const rawState = await storageGet(Object.values(STORAGE_KEYS));
      const normalized = normalizeStoredState(rawState);

      state.settings = normalized.settings;
      state.account = normalized.account;
      state.popupState = normalized.popupState;
      state.session = normalized.session;
      state.automation = normalized.automation;
      state.allowlist = normalized.allowlist;
      state.analytics = normalized.analytics;

      if (Object.keys(normalized.nextState).length > 0) {
        await storageSet(normalized.nextState);
      }

      bindEvents();
      patchLocationChangeEvents();
      startMutationObserver();
      applyExperience();
    } catch (error) {
      console.error("YouTube Focus Clean could not initialize:", error);
    }
  }

  function bindEvents() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      let shouldApply = false;

      if (changes[STORAGE_KEYS.settings]) {
        state.settings = sanitizeSettings(changes[STORAGE_KEYS.settings].newValue);
        shouldApply = true;
      }

      if (changes[STORAGE_KEYS.account]) {
        state.account = sanitizeAccount(changes[STORAGE_KEYS.account].newValue);
        shouldApply = true;
      }

      if (changes[STORAGE_KEYS.popupState]) {
        state.popupState = sanitizePopupState(changes[STORAGE_KEYS.popupState].newValue);
        shouldApply = true;
      }

      if (changes[STORAGE_KEYS.session]) {
        state.session = sanitizeSessionState(changes[STORAGE_KEYS.session].newValue);
        shouldApply = true;
      }

      if (changes[STORAGE_KEYS.automation]) {
        state.automation = sanitizeAutomationState(changes[STORAGE_KEYS.automation].newValue);
        shouldApply = true;
      }

      if (changes[STORAGE_KEYS.allowlist]) {
        state.allowlist = sanitizeAllowlistState(changes[STORAGE_KEYS.allowlist].newValue);
        shouldApply = true;
      }

      if (changes[STORAGE_KEYS.analytics]) {
        state.analytics = sanitizeAnalyticsState(changes[STORAGE_KEYS.analytics].newValue);
      }

      if (shouldApply) {
        scheduleApply(0);
      }
    });

    [
      "yt-navigate-start",
      "yt-navigate-finish",
      "yt-page-data-updated",
      "spfdone",
      "popstate",
      LOCATION_CHANGE_EVENT
    ].forEach((eventName) => {
      window.addEventListener(eventName, onNavigationEvent, true);
      document.addEventListener(eventName, onNavigationEvent, true);
    });
  }

  function onNavigationEvent() {
    scheduleApply(0);
  }

  function patchLocationChangeEvents() {
    if (window.__ytfcLocationPatchApplied) {
      return;
    }

    const dispatch = () => {
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    };
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushStateWrapper(...args) {
      const result = originalPushState.apply(this, args);
      dispatch();
      return result;
    };

    history.replaceState = function replaceStateWrapper(...args) {
      const result = originalReplaceState.apply(this, args);
      dispatch();
      return result;
    };

    window.addEventListener("popstate", dispatch, true);
    window.__ytfcLocationPatchApplied = true;
  }

  function startMutationObserver() {
    if (!document.documentElement || state.observer) {
      return;
    }

    state.observer = new MutationObserver((mutations) => {
      const shouldApply = mutations.some((mutation) => {
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
          return false;
        }

        return Array.from(mutation.addedNodes).some((node) => node instanceof HTMLElement);
      });

      if (shouldApply) {
        scheduleApply(90);
      }
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleApply(delay = 0) {
    window.clearTimeout(state.applyTimeoutId);
    state.applyTimeoutId = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        applyExperience();
      });
    }, delay);
  }

  function applyExperience() {
    const currentUrl = window.location.href;
    const allowlisted = urlMatchesAllowlist(currentUrl, state.allowlist);
    const withinSchedule = isWithinSchedule(state.automation);
    const baseEffectiveSettings = getEffectiveSettings(state.settings, state.account, state.session);
    const effectiveSettings = allowlisted || !withinSchedule
      ? disableAllSettings(baseEffectiveSettings)
      : baseEffectiveSettings;

    applyRootClasses(effectiveSettings, { allowlisted, withinSchedule });
    syncHomeFocusMessage(effectiveSettings);
    syncShortsHiding(effectiveSettings);
    trackAnalytics(currentUrl, allowlisted, effectiveSettings);
  }

  function disableAllSettings(settings) {
    return Object.fromEntries(Object.keys(settings).map((key) => [key, false]));
  }

  function applyRootClasses(effectiveSettings, flags) {
    const root = document.documentElement;

    Object.entries(ROOT_CLASS_MAP).forEach(([settingKey, className]) => {
      root.classList.toggle(className, Boolean(effectiveSettings[settingKey]));
    });

    root.classList.toggle("ytfc-allowlisted", flags.allowlisted);
    root.classList.toggle("ytfc-outside-schedule", !flags.withinSchedule);
  }

  function syncHomeFocusMessage(effectiveSettings) {
    const existingMessage = document.getElementById("ytfc-focus-message");
    const shouldShowMessage =
      Boolean(effectiveSettings.hideHomeFeed) && isHomePage() && Boolean(document.body);

    if (!shouldShowMessage) {
      existingMessage?.remove();
      return;
    }

    const focusMessage = existingMessage || createFocusMessage();

    updateFocusMessage(focusMessage, effectiveSettings);

    if (!existingMessage) {
      document.body.append(focusMessage);
      return;
    }

    if (focusMessage.parentElement !== document.body) {
      document.body.append(focusMessage);
    }
  }

  function syncShortsHiding(effectiveSettings) {
    pruneManagedShortsElements();

    if (!effectiveSettings.hideShorts) {
      clearManagedShortsHiding();
      return;
    }

    SHORTS_SURFACE_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        markElementAsShorts(element);
      });
    });

    SHORTS_LINK_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((link) => {
        const container = link.closest(SHORTS_CONTAINER_SELECTORS.join(","));
        markElementAsShorts(container || link);
      });
    });
  }

  function pruneManagedShortsElements() {
    state.managedShortsElements.forEach((element) => {
      if (!element.isConnected) {
        state.managedShortsElements.delete(element);
      }
    });
  }

  function clearManagedShortsHiding() {
    state.managedShortsElements.forEach((element) => {
      element.classList.remove("ytfc-managed-hide");
      element.removeAttribute("data-ytfc-managed");
    });

    state.managedShortsElements.clear();
  }

  function markElementAsShorts(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) {
      return;
    }

    element.dataset.ytfcManaged = "shorts";
    element.classList.add("ytfc-managed-hide");
    state.managedShortsElements.add(element);
  }

  function createFocusMessage() {
    const section = document.createElement("section");
    const shell = document.createElement("div");
    const card = document.createElement("div");
    const header = document.createElement("div");
    const eyebrow = document.createElement("p");
    const pill = document.createElement("span");
    const title = document.createElement("h2");
    const copy = document.createElement("p");
    const note = document.createElement("div");
    const noteLabel = document.createElement("span");
    const noteValue = document.createElement("p");
    const links = document.createElement("div");

    section.id = "ytfc-focus-message";
    section.setAttribute("role", "status");

    shell.className = "ytfc-focus-shell";
    card.className = "ytfc-focus-card";
    header.className = "ytfc-focus-header";

    eyebrow.className = "ytfc-focus-eyebrow";
    eyebrow.textContent = "YouTube Focus";

    pill.className = "ytfc-focus-pill";
    pill.id = "ytfc-focus-profile";

    title.className = "ytfc-focus-title";
    title.id = "ytfc-focus-title";

    copy.className = "ytfc-focus-copy";
    copy.id = "ytfc-focus-copy";

    note.className = "ytfc-focus-note";
    note.id = "ytfc-focus-note";

    noteLabel.className = "ytfc-focus-note-label";
    noteLabel.textContent = "Current intention";

    noteValue.className = "ytfc-focus-note-value";
    noteValue.id = "ytfc-focus-note-value";

    links.className = "ytfc-focus-links";
    links.append(
      createFocusLink("/feed/subscriptions", "Subscriptions"),
      createFocusLink("/playlist?list=WL", "Watch later"),
      createFocusLink("/feed/playlists", "Playlists")
    );

    note.append(noteLabel, noteValue);
    header.append(eyebrow, pill);
    card.append(header, title, copy, note, links);
    shell.append(card);
    section.append(shell);

    return section;
  }

  function createFocusLink(href, label) {
    const link = document.createElement("a");
    link.className = "ytfc-focus-link";
    link.href = href;
    link.textContent = label;
    return link;
  }

  function updateFocusMessage(message, effectiveSettings) {
    const title = message.querySelector("#ytfc-focus-title");
    const copy = message.querySelector("#ytfc-focus-copy");
    const note = message.querySelector("#ytfc-focus-note");
    const noteValue = message.querySelector("#ytfc-focus-note-value");
    const profile = message.querySelector("#ytfc-focus-profile");
    const activeShieldCount = countActiveShields(effectiveSettings);
    const resolvedProfileId =
      state.popupState.activeProfile !== "custom"
        ? state.popupState.activeProfile
        : resolveActiveProfile(state.settings);
    const currentProfile = PROFILE_META[resolvedProfileId];
    const focusNote = state.popupState.focusNote.trim();

    if (title) {
      title.textContent = focusNote ? "Stay with what you came for." : "Home is quiet now.";
    }

    if (copy) {
      copy.textContent = focusNote
        ? "Use search, open a saved destination, and leave with the answer you needed instead of the next suggestion."
        : "Search with intention, jump into subscriptions, or open something you already chose instead of browsing the feed.";
    }

    if (profile) {
      profile.textContent = currentProfile
        ? `${currentProfile.label} - ${activeShieldCount} live`
        : `${activeShieldCount} shields live`;
    }

    if (note && noteValue) {
      note.hidden = !focusNote;
      noteValue.textContent = focusNote;
    }
  }

  function trackAnalytics(currentUrl, allowlisted, effectiveSettings) {
    const activeShieldCount = countActiveShields(effectiveSettings);

    if (allowlisted && state.lastAllowlistedUrl !== currentUrl) {
      state.lastAllowlistedUrl = currentUrl;
      void persistAnalyticsDelta({ allowlistHits: 1 });
    }

    if (activeShieldCount > 0 && state.lastProtectedUrl !== currentUrl) {
      state.lastProtectedUrl = currentUrl;
      void persistAnalyticsDelta({ protectedViews: 1 });
    }
  }

  async function persistAnalyticsDelta(delta) {
    const nextAnalytics = bumpAnalytics(state.analytics, delta);
    state.analytics = nextAnalytics;

    try {
      await storageSet({
        [STORAGE_KEYS.analytics]: nextAnalytics
      });
    } catch (error) {
      console.error("YouTube Focus Clean analytics write failed:", error);
    }
  }

  function isHomePage() {
    return window.location.pathname === "/" || window.location.pathname === "";
  }
})();
