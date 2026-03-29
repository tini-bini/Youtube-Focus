(function (global) {
  "use strict";

  /**
   * @typedef {object} SettingsState
   * @property {boolean} hideHomeFeed
   * @property {boolean} hideShorts
   * @property {boolean} hideComments
   * @property {boolean} hideSidebar
   * @property {boolean} hideExplore
   * @property {boolean} hideNotifications
   * @property {boolean} hideTopicChips
   */

  /**
   * @typedef {object} AccountState
   * @property {boolean} hasPremium
   * @property {string} plan
   * @property {string} billingCycle
   * @property {string} activatedAt
   */

  /**
   * @typedef {object} PopupState
   * @property {string} focusNote
   * @property {string} activeProfile
   */

  /**
   * @typedef {object} SessionState
   * @property {string} snoozedUntil
   * @property {string} lastAction
   * @property {string} lastUpdatedAt
   */

  /**
   * @typedef {object} AutomationState
   * @property {boolean} scheduleEnabled
   * @property {number[]} activeDays
   * @property {string} startTime
   * @property {string} endTime
   */

  /**
   * @typedef {object} AllowlistState
   * @property {string[]} rules
   */

  /**
   * @typedef {object} AnalyticsState
   * @property {number} snoozeCount
   * @property {number} profileApplies
   * @property {number} protectedViews
   * @property {number} allowlistHits
   * @property {number} exports
   * @property {number} imports
   */

  const STORAGE_KEYS = Object.freeze({
    settings: "ytFocusCleanSettings",
    account: "ytFocusCleanAccount",
    theme: "ytFocusCleanTheme",
    popupState: "ytFocusCleanPopupState",
    session: "ytFocusCleanSession",
    automation: "ytFocusCleanAutomation",
    allowlist: "ytFocusCleanAllowlist",
    analytics: "ytFocusCleanAnalytics"
  });

  /** @type {Readonly<SettingsState>} */
  const DEFAULT_SETTINGS = Object.freeze({
    hideHomeFeed: true,
    hideShorts: true,
    hideComments: true,
    hideSidebar: true,
    hideExplore: false,
    hideNotifications: false,
    hideTopicChips: false
  });

  /** @type {Readonly<AccountState>} */
  const DEFAULT_ACCOUNT = Object.freeze({
    hasPremium: false,
    plan: "free",
    billingCycle: "monthly",
    activatedAt: ""
  });

  /** @type {Readonly<PopupState>} */
  const DEFAULT_POPUP_STATE = Object.freeze({
    focusNote: "",
    activeProfile: "flow"
  });

  /** @type {Readonly<SessionState>} */
  const DEFAULT_SESSION_STATE = Object.freeze({
    snoozedUntil: "",
    lastAction: "",
    lastUpdatedAt: ""
  });

  /** @type {Readonly<AutomationState>} */
  const DEFAULT_AUTOMATION_STATE = Object.freeze({
    scheduleEnabled: false,
    activeDays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "17:00"
  });

  /** @type {Readonly<AllowlistState>} */
  const DEFAULT_ALLOWLIST_STATE = Object.freeze({
    rules: []
  });

  /** @type {Readonly<AnalyticsState>} */
  const DEFAULT_ANALYTICS_STATE = Object.freeze({
    snoozeCount: 0,
    profileApplies: 0,
    protectedViews: 0,
    allowlistHits: 0,
    exports: 0,
    imports: 0
  });

  const PREMIUM_SETTING_KEYS = Object.freeze([
    "hideComments",
    "hideSidebar",
    "hideExplore",
    "hideNotifications",
    "hideTopicChips"
  ]);

  const SETTING_META = Object.freeze({
    hideHomeFeed: {
      label: "Homepage feed",
      description: "Replace the algorithmic home feed with a calmer focus surface.",
      tier: "free"
    },
    hideShorts: {
      label: "Shorts",
      description: "Remove Shorts rails, links, and quick-hit entry points.",
      tier: "free"
    },
    hideComments: {
      label: "Comments",
      description: "Quiet the discussion layer on watch pages when you want flow.",
      tier: "pro"
    },
    hideSidebar: {
      label: "Sidebar recommendations",
      description: "Strip the watch-next rail to reduce drift into more videos.",
      tier: "pro"
    },
    hideExplore: {
      label: "Explore navigation",
      description: "Hide Explore and Trending entry points from the side rails.",
      tier: "pro"
    },
    hideNotifications: {
      label: "Notifications",
      description: "Remove the top-bar notification bell and notification menus.",
      tier: "pro"
    },
    hideTopicChips: {
      label: "Topic chips",
      description: "Hide the keyword chip bars that keep browsing sessions going.",
      tier: "pro"
    }
  });

  const PROFILE_META = Object.freeze({
    essentials: {
      id: "essentials",
      label: "Essentials",
      shortLabel: "Essentials",
      description: "Trim the biggest attention traps.",
      settings: {
        hideHomeFeed: true,
        hideShorts: true,
        hideComments: false,
        hideSidebar: false,
        hideExplore: false,
        hideNotifications: false,
        hideTopicChips: false
      }
    },
    flow: {
      id: "flow",
      label: "Flow",
      shortLabel: "Flow",
      description: "Best default for intentional everyday watching.",
      settings: {
        hideHomeFeed: true,
        hideShorts: true,
        hideComments: true,
        hideSidebar: false,
        hideExplore: false,
        hideNotifications: false,
        hideTopicChips: false
      }
    },
    deepWork: {
      id: "deepWork",
      label: "Deep Work",
      shortLabel: "Deep Work",
      description: "Arm every shield for the quietest possible surface.",
      settings: {
        hideHomeFeed: true,
        hideShorts: true,
        hideComments: true,
        hideSidebar: true,
        hideExplore: true,
        hideNotifications: true,
        hideTopicChips: true
      }
    }
  });

  const LEGACY_PRESET_TO_PROFILE = Object.freeze({
    sprint: "essentials",
    flow: "flow",
    always: "deepWork"
  });

  const CHECKOUT_CONFIG = Object.freeze({
    preferredCheckoutUrl: "",
    premiumPayPalMeBaseUrl: "https://paypal.me/TiniFlegar",
    premiumAmount: "10",
    premiumCurrency: "EUR",
    donationPayPalMeBaseUrl: "https://paypal.me/TiniFlegar"
  });

  function clone(object) {
    return JSON.parse(JSON.stringify(object));
  }

  function normalizeHttpUrl(url) {
    if (typeof url !== "string" || url.trim() === "") {
      return "";
    }

    try {
      const parsed = new URL(url.trim());

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }

      parsed.hash = "";

      return parsed.toString();
    } catch {
      return "";
    }
  }

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(result);
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
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

  function sanitizePopupState(rawPopupState) {
    const nextPopupState = { ...DEFAULT_POPUP_STATE };

    if (!rawPopupState || typeof rawPopupState !== "object") {
      return nextPopupState;
    }

    nextPopupState.focusNote =
      typeof rawPopupState.focusNote === "string"
        ? rawPopupState.focusNote.slice(0, 72)
        : DEFAULT_POPUP_STATE.focusNote;

    const requestedProfile =
      typeof rawPopupState.activeProfile === "string"
        ? rawPopupState.activeProfile
        : typeof rawPopupState.sessionPreset === "string"
          ? LEGACY_PRESET_TO_PROFILE[rawPopupState.sessionPreset]
          : DEFAULT_POPUP_STATE.activeProfile;

    nextPopupState.activeProfile =
      requestedProfile === "custom" || PROFILE_META[requestedProfile]
        ? requestedProfile
        : DEFAULT_POPUP_STATE.activeProfile;

    return nextPopupState;
  }

  function sanitizeSessionState(rawSessionState) {
    const nextSessionState = { ...DEFAULT_SESSION_STATE };

    if (!rawSessionState || typeof rawSessionState !== "object") {
      return nextSessionState;
    }

    nextSessionState.snoozedUntil =
      typeof rawSessionState.snoozedUntil === "string" ? rawSessionState.snoozedUntil : "";
    nextSessionState.lastAction =
      typeof rawSessionState.lastAction === "string" ? rawSessionState.lastAction : "";
    nextSessionState.lastUpdatedAt =
      typeof rawSessionState.lastUpdatedAt === "string" ? rawSessionState.lastUpdatedAt : "";

    if (!Number.isFinite(Date.parse(nextSessionState.snoozedUntil))) {
      nextSessionState.snoozedUntil = "";
    }

    if (!Number.isFinite(Date.parse(nextSessionState.lastUpdatedAt))) {
      nextSessionState.lastUpdatedAt = "";
    }

    return nextSessionState;
  }

  function sanitizeAutomationState(rawAutomationState) {
    const nextAutomationState = { ...DEFAULT_AUTOMATION_STATE };

    if (!rawAutomationState || typeof rawAutomationState !== "object") {
      return nextAutomationState;
    }

    if (typeof rawAutomationState.scheduleEnabled === "boolean") {
      nextAutomationState.scheduleEnabled = rawAutomationState.scheduleEnabled;
    }

    nextAutomationState.startTime = normalizeTimeString(
      rawAutomationState.startTime,
      DEFAULT_AUTOMATION_STATE.startTime
    );
    nextAutomationState.endTime = normalizeTimeString(
      rawAutomationState.endTime,
      DEFAULT_AUTOMATION_STATE.endTime
    );
    nextAutomationState.activeDays = normalizeActiveDays(rawAutomationState.activeDays);

    return nextAutomationState;
  }

  function sanitizeAllowlistState(rawAllowlistState) {
    const nextAllowlistState = { ...DEFAULT_ALLOWLIST_STATE };

    if (!rawAllowlistState || typeof rawAllowlistState !== "object") {
      return nextAllowlistState;
    }

    const rawRules = Array.isArray(rawAllowlistState.rules)
      ? rawAllowlistState.rules
      : typeof rawAllowlistState.rules === "string"
        ? rawAllowlistState.rules.split(/\r?\n/)
        : [];

    nextAllowlistState.rules = Array.from(
      new Set(
        rawRules
          .map((rule) => (typeof rule === "string" ? rule.trim() : ""))
          .filter(Boolean)
          .map((rule) => rule.slice(0, 120))
      )
    ).slice(0, 80);

    return nextAllowlistState;
  }

  function sanitizeAnalyticsState(rawAnalyticsState) {
    const nextAnalyticsState = { ...DEFAULT_ANALYTICS_STATE };

    if (!rawAnalyticsState || typeof rawAnalyticsState !== "object") {
      return nextAnalyticsState;
    }

    Object.keys(DEFAULT_ANALYTICS_STATE).forEach((key) => {
      if (Number.isFinite(rawAnalyticsState[key]) && rawAnalyticsState[key] >= 0) {
        nextAnalyticsState[key] = Math.floor(rawAnalyticsState[key]);
      }
    });

    return nextAnalyticsState;
  }

  function normalizeTimeString(value, fallbackTime = DEFAULT_AUTOMATION_STATE.startTime) {
    if (typeof value !== "string") {
      return fallbackTime;
    }

    const match = value.match(/^(\d{2}):(\d{2})$/);

    if (!match) {
      return fallbackTime;
    }

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return fallbackTime;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function normalizeActiveDays(rawActiveDays) {
    if (!Array.isArray(rawActiveDays)) {
      return [...DEFAULT_AUTOMATION_STATE.activeDays];
    }

    const days = Array.from(
      new Set(
        rawActiveDays
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          .sort((left, right) => left - right)
      )
    );

    return days.length > 0 ? days : [...DEFAULT_AUTOMATION_STATE.activeDays];
  }

  function areObjectsEqual(rawValue, normalizedValue, keys) {
    if (!rawValue || typeof rawValue !== "object") {
      return false;
    }

    return keys.every((key) => {
      if (Array.isArray(normalizedValue[key])) {
        return JSON.stringify(rawValue[key] || []) === JSON.stringify(normalizedValue[key]);
      }

      return rawValue[key] === normalizedValue[key];
    });
  }

  function areSettingsEqual(rawSettings, normalizedSettings) {
    return areObjectsEqual(rawSettings, normalizedSettings, Object.keys(DEFAULT_SETTINGS));
  }

  function areAccountsEqual(rawAccount, normalizedAccount) {
    return areObjectsEqual(rawAccount, normalizedAccount, Object.keys(DEFAULT_ACCOUNT));
  }

  function arePopupStatesEqual(rawPopupState, normalizedPopupState) {
    if (
      areObjectsEqual(rawPopupState, normalizedPopupState, Object.keys(DEFAULT_POPUP_STATE))
    ) {
      return true;
    }

    return Boolean(rawPopupState && typeof rawPopupState === "object") &&
      rawPopupState.focusNote === normalizedPopupState.focusNote &&
      LEGACY_PRESET_TO_PROFILE[rawPopupState.sessionPreset] === normalizedPopupState.activeProfile;
  }

  function areSessionStatesEqual(rawSessionState, normalizedSessionState) {
    return areObjectsEqual(rawSessionState, normalizedSessionState, Object.keys(DEFAULT_SESSION_STATE));
  }

  function areAutomationStatesEqual(rawAutomationState, normalizedAutomationState) {
    return areObjectsEqual(
      rawAutomationState,
      normalizedAutomationState,
      Object.keys(DEFAULT_AUTOMATION_STATE)
    );
  }

  function areAllowlistStatesEqual(rawAllowlistState, normalizedAllowlistState) {
    return areObjectsEqual(rawAllowlistState, normalizedAllowlistState, Object.keys(DEFAULT_ALLOWLIST_STATE));
  }

  function areAnalyticsStatesEqual(rawAnalyticsState, normalizedAnalyticsState) {
    return areObjectsEqual(rawAnalyticsState, normalizedAnalyticsState, Object.keys(DEFAULT_ANALYTICS_STATE));
  }

  function getProfileSettings(profileId) {
    const profile = PROFILE_META[profileId] || PROFILE_META[DEFAULT_POPUP_STATE.activeProfile];
    return { ...profile.settings };
  }

  function getEffectiveSettings(settings, account, sessionState) {
    const effectiveSettings = { ...sanitizeSettings(settings) };
    const safeAccount = sanitizeAccount(account);
    const safeSession = sanitizeSessionState(sessionState);

    if (!safeAccount.hasPremium) {
      PREMIUM_SETTING_KEYS.forEach((key) => {
        effectiveSettings[key] = false;
      });
    }

    if (isSessionSnoozed(safeSession)) {
      Object.keys(effectiveSettings).forEach((key) => {
        effectiveSettings[key] = false;
      });
    }

    return effectiveSettings;
  }

  function countActiveShields(settings) {
    return Object.values(settings).filter(Boolean).length;
  }

  function isSessionSnoozed(sessionState, now = Date.now()) {
    const session = sanitizeSessionState(sessionState);

    if (!session.snoozedUntil) {
      return false;
    }

    return Date.parse(session.snoozedUntil) > now;
  }

  function getSessionRemainingMs(sessionState, now = Date.now()) {
    if (!isSessionSnoozed(sessionState, now)) {
      return 0;
    }

    return Math.max(0, Date.parse(sessionState.snoozedUntil) - now);
  }

  function createSnoozedSession(minutes, now = new Date()) {
    const durationMinutes = Number.isFinite(minutes) ? Math.max(1, minutes) : 15;
    const snoozedUntil = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

    return sanitizeSessionState({
      snoozedUntil,
      lastAction: "snoozed",
      lastUpdatedAt: now.toISOString()
    });
  }

  function clearSnooze(now = new Date()) {
    return sanitizeSessionState({
      snoozedUntil: "",
      lastAction: "resumed",
      lastUpdatedAt: now.toISOString()
    });
  }

  function resolveActiveProfile(settings) {
    const safeSettings = sanitizeSettings(settings);
    const profileId = Object.keys(PROFILE_META).find((candidateId) => {
      const candidateSettings = PROFILE_META[candidateId].settings;
      return Object.keys(DEFAULT_SETTINGS).every((key) => candidateSettings[key] === safeSettings[key]);
    });

    return profileId || "custom";
  }

  function formatClockTime(isoString) {
    const parsed = Date.parse(isoString);

    if (!Number.isFinite(parsed)) {
      return "";
    }

    return new Date(parsed).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatRemainingDuration(milliseconds) {
    if (milliseconds <= 0) {
      return "now";
    }

    const totalMinutes = Math.ceil(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h`;
    }

    return `${minutes}m`;
  }

  function timeStringToMinutes(timeString) {
    const match = normalizeTimeString(timeString).match(/^(\d{2}):(\d{2})$/);
    return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
  }

  function isWithinSchedule(automationState, now = new Date()) {
    const safeAutomationState = sanitizeAutomationState(automationState);

    if (!safeAutomationState.scheduleEnabled) {
      return true;
    }

    const startMinutes = timeStringToMinutes(safeAutomationState.startTime);
    const endMinutes = timeStringToMinutes(safeAutomationState.endTime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();
    const previousDay = (currentDay + 6) % 7;

    if (startMinutes === endMinutes) {
      return safeAutomationState.activeDays.includes(currentDay);
    }

    if (startMinutes < endMinutes) {
      return (
        safeAutomationState.activeDays.includes(currentDay) &&
        currentMinutes >= startMinutes &&
        currentMinutes < endMinutes
      );
    }

    if (currentMinutes >= startMinutes) {
      return safeAutomationState.activeDays.includes(currentDay);
    }

    if (currentMinutes < endMinutes) {
      return safeAutomationState.activeDays.includes(previousDay);
    }

    return false;
  }

  function formatActiveDays(activeDays) {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const safeDays = normalizeActiveDays(activeDays);

    if (safeDays.length === 7) {
      return "Every day";
    }

    if (JSON.stringify(safeDays) === JSON.stringify([1, 2, 3, 4, 5])) {
      return "Weekdays";
    }

    return safeDays.map((day) => labels[day]).join(", ");
  }

  function urlMatchesAllowlist(url, allowlistState) {
    const safeAllowlist = sanitizeAllowlistState(allowlistState);

    if (safeAllowlist.rules.length === 0) {
      return false;
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return false;
    }

    const lowerHref = parsedUrl.href.toLowerCase();
    const lowerPath = parsedUrl.pathname.toLowerCase();
    const lowerPathAndSearch = `${parsedUrl.pathname}${parsedUrl.search}`.toLowerCase();

    return safeAllowlist.rules.some((rule) => {
      const normalizedRule = rule.trim().toLowerCase();

      if (!normalizedRule) {
        return false;
      }

      if (normalizedRule.startsWith("http://") || normalizedRule.startsWith("https://")) {
        return lowerHref.startsWith(normalizedRule);
      }

      if (normalizedRule.includes("youtube.com/")) {
        return lowerHref.includes(normalizedRule.replace(/^https?:\/\//, ""));
      }

      if (normalizedRule.startsWith("@")) {
        return lowerPath.startsWith(`/${normalizedRule}`);
      }

      if (normalizedRule.startsWith("/")) {
        return normalizedRule.includes("?")
          ? lowerPathAndSearch.startsWith(normalizedRule)
          : lowerPath.startsWith(normalizedRule);
      }

      return lowerHref.includes(normalizedRule);
    });
  }

  function bumpAnalytics(analyticsState, delta) {
    const nextAnalyticsState = sanitizeAnalyticsState(analyticsState);

    Object.keys(delta || {}).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(nextAnalyticsState, key)) {
        return;
      }

      if (!Number.isFinite(delta[key])) {
        return;
      }

      nextAnalyticsState[key] += Math.max(0, Math.floor(delta[key]));
    });

    return nextAnalyticsState;
  }

  function normalizePayPalMeBaseUrl(url) {
    if (typeof url !== "string") {
      return "";
    }

    try {
      const parsed = new URL(url.trim());
      const pathSegments = parsed.pathname.split("/").filter(Boolean);

      if (
        parsed.protocol !== "https:" ||
        !["paypal.me", "www.paypal.me"].includes(parsed.hostname.toLowerCase()) ||
        pathSegments.length !== 1 ||
        !/^[A-Za-z0-9._-]+$/.test(pathSegments[0])
      ) {
        return "";
      }

      return `https://paypal.me/${pathSegments[0]}`;
    } catch {
      return "";
    }
  }

  function normalizeCurrencyCode(currencyCode) {
    if (typeof currencyCode !== "string") {
      return "";
    }

    const normalized = currencyCode.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
  }

  function normalizePayPalMeAmount(amount) {
    if (typeof amount === "number") {
      if (!Number.isFinite(amount) || amount <= 0) {
        return "";
      }

      return formatPayPalMeAmount(amount);
    }

    if (typeof amount !== "string") {
      return "";
    }

    const trimmed = amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      return "";
    }

    const numericAmount = Number.parseFloat(trimmed);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return "";
    }

    return formatPayPalMeAmount(numericAmount);
  }

  function formatPayPalMeAmount(amount) {
    const fixed = amount.toFixed(2);
    return fixed.endsWith("00")
      ? fixed.slice(0, -3)
      : fixed.endsWith("0")
        ? fixed.slice(0, -1)
        : fixed;
  }

  function createPayPalMeUrl(baseUrl, options = {}) {
    const normalizedBaseUrl = normalizePayPalMeBaseUrl(baseUrl);

    if (!normalizedBaseUrl) {
      return "";
    }

    const normalizedAmount = normalizePayPalMeAmount(options.amount ?? "");

    if (!normalizedAmount) {
      return normalizedBaseUrl;
    }

    const normalizedCurrencyCode = normalizeCurrencyCode(options.currency ?? "");
    const amountSegment = normalizedCurrencyCode
      ? `${normalizedAmount}${normalizedCurrencyCode}`
      : normalizedAmount;

    return `${normalizedBaseUrl}/${amountSegment}`;
  }

  function validatePayPalMeUrl(url) {
    if (typeof url !== "string" || url.trim() === "") {
      return {
        isValid: false,
        normalizedUrl: "",
        reason: "Missing PayPal.Me URL."
      };
    }

    try {
      const parsed = new URL(url.trim());
      const pathSegments = parsed.pathname.split("/").filter(Boolean);

      if (
        parsed.protocol !== "https:" ||
        !["paypal.me", "www.paypal.me"].includes(parsed.hostname.toLowerCase())
      ) {
        return {
          isValid: false,
          normalizedUrl: "",
          reason: "PayPal.Me URLs must use https://paypal.me/."
        };
      }

      if (pathSegments.length < 1 || pathSegments.length > 2) {
        return {
          isValid: false,
          normalizedUrl: "",
          reason: "PayPal.Me URLs must target a single profile, with an optional amount."
        };
      }

      if (!/^[A-Za-z0-9._-]+$/.test(pathSegments[0])) {
        return {
          isValid: false,
          normalizedUrl: "",
          reason: "PayPal.Me profile names can only use safe path characters."
        };
      }

      if (pathSegments.length === 2 && !/^\d+(\.\d{1,2})?([A-Z]{3})?$/.test(pathSegments[1])) {
        return {
          isValid: false,
          normalizedUrl: "",
          reason: "PayPal.Me amount segments must be numeric, optionally followed by a 3-letter currency code."
        };
      }

      parsed.hash = "";

      return {
        isValid: true,
        normalizedUrl: parsed.toString(),
        reason: ""
      };
    } catch {
      return {
        isValid: false,
        normalizedUrl: "",
        reason: "PayPal.Me URL is malformed."
      };
    }
  }

  function resolveCheckoutLinks(config = CHECKOUT_CONFIG) {
    const preferredCheckoutUrl = normalizeHttpUrl(config.preferredCheckoutUrl);
    const generatedPremiumUrl = createPayPalMeUrl(config.premiumPayPalMeBaseUrl, {
      amount: config.premiumAmount,
      currency: config.premiumCurrency
    });
    const generatedDonationUrl = createPayPalMeUrl(config.donationPayPalMeBaseUrl);
    const premiumCandidateUrl = preferredCheckoutUrl || generatedPremiumUrl;
    const premiumValidation = preferredCheckoutUrl
      ? {
          isValid: true,
          normalizedUrl: preferredCheckoutUrl,
          reason: ""
        }
      : validatePayPalMeUrl(premiumCandidateUrl);
    const donationValidation = validatePayPalMeUrl(generatedDonationUrl);

    return {
      premium: {
        url: premiumValidation.normalizedUrl,
        isValid: premiumValidation.isValid,
        reason: premiumValidation.reason,
        usesPayPalMe: !preferredCheckoutUrl && premiumValidation.isValid
      },
      donation: {
        url: donationValidation.normalizedUrl,
        isValid: donationValidation.isValid,
        reason: donationValidation.reason,
        usesPayPalMe: donationValidation.isValid
      }
    };
  }

  function normalizeStoredState(raw) {
    const settings = sanitizeSettings(raw[STORAGE_KEYS.settings]);
    const account = sanitizeAccount(raw[STORAGE_KEYS.account]);
    const popupState = sanitizePopupState(raw[STORAGE_KEYS.popupState]);
    const session = sanitizeSessionState(raw[STORAGE_KEYS.session]);
    const automation = sanitizeAutomationState(raw[STORAGE_KEYS.automation]);
    const allowlist = sanitizeAllowlistState(raw[STORAGE_KEYS.allowlist]);
    const analytics = sanitizeAnalyticsState(raw[STORAGE_KEYS.analytics]);
    const nextState = {};

    if (!areSettingsEqual(raw[STORAGE_KEYS.settings], settings)) {
      nextState[STORAGE_KEYS.settings] = settings;
    }

    if (!areAccountsEqual(raw[STORAGE_KEYS.account], account)) {
      nextState[STORAGE_KEYS.account] = account;
    }

    if (!arePopupStatesEqual(raw[STORAGE_KEYS.popupState], popupState)) {
      nextState[STORAGE_KEYS.popupState] = popupState;
    }

    if (!areSessionStatesEqual(raw[STORAGE_KEYS.session], session)) {
      nextState[STORAGE_KEYS.session] = session;
    }

    if (!areAutomationStatesEqual(raw[STORAGE_KEYS.automation], automation)) {
      nextState[STORAGE_KEYS.automation] = automation;
    }

    if (!areAllowlistStatesEqual(raw[STORAGE_KEYS.allowlist], allowlist)) {
      nextState[STORAGE_KEYS.allowlist] = allowlist;
    }

    if (!areAnalyticsStatesEqual(raw[STORAGE_KEYS.analytics], analytics)) {
      nextState[STORAGE_KEYS.analytics] = analytics;
    }

    return {
      settings,
      account,
      popupState,
      session,
      automation,
      allowlist,
      analytics,
      nextState
    };
  }

  const api = Object.freeze({
    STORAGE_KEYS,
    DEFAULT_SETTINGS: clone(DEFAULT_SETTINGS),
    DEFAULT_ACCOUNT: clone(DEFAULT_ACCOUNT),
    DEFAULT_POPUP_STATE: clone(DEFAULT_POPUP_STATE),
    DEFAULT_SESSION_STATE: clone(DEFAULT_SESSION_STATE),
    DEFAULT_AUTOMATION_STATE: clone(DEFAULT_AUTOMATION_STATE),
    DEFAULT_ALLOWLIST_STATE: clone(DEFAULT_ALLOWLIST_STATE),
    DEFAULT_ANALYTICS_STATE: clone(DEFAULT_ANALYTICS_STATE),
    PREMIUM_SETTING_KEYS: [...PREMIUM_SETTING_KEYS],
    SETTING_META: clone(SETTING_META),
    PROFILE_META: clone(PROFILE_META),
    CHECKOUT_CONFIG,
    storageGet,
    storageSet,
    sanitizeSettings,
    sanitizeAccount,
    sanitizePopupState,
    sanitizeSessionState,
    sanitizeAutomationState,
    sanitizeAllowlistState,
    sanitizeAnalyticsState,
    areSettingsEqual,
    areAccountsEqual,
    arePopupStatesEqual,
    areSessionStatesEqual,
    areAutomationStatesEqual,
    areAllowlistStatesEqual,
    areAnalyticsStatesEqual,
    getProfileSettings,
    getEffectiveSettings,
    countActiveShields,
    isSessionSnoozed,
    getSessionRemainingMs,
    createSnoozedSession,
    clearSnooze,
    resolveActiveProfile,
    formatClockTime,
    formatRemainingDuration,
    isWithinSchedule,
    formatActiveDays,
    urlMatchesAllowlist,
    bumpAnalytics,
    normalizeHttpUrl,
    normalizePayPalMeBaseUrl,
    normalizeCurrencyCode,
    normalizePayPalMeAmount,
    createPayPalMeUrl,
    validatePayPalMeUrl,
    resolveCheckoutLinks,
    normalizeStoredState
  });

  /** @type {any} */ (global).YTFCShared = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
