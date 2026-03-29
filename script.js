const {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_ACCOUNT,
  DEFAULT_POPUP_STATE,
  DEFAULT_SESSION_STATE,
  DEFAULT_AUTOMATION_STATE,
  DEFAULT_ALLOWLIST_STATE,
  DEFAULT_ANALYTICS_STATE,
  PREMIUM_SETTING_KEYS,
  SETTING_META,
  PROFILE_META,
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
  normalizeStoredState,
  getProfileSettings,
  getEffectiveSettings,
  countActiveShields,
  createSnoozedSession,
  clearSnooze,
  isSessionSnoozed,
  getSessionRemainingMs,
  resolveActiveProfile,
  formatClockTime,
  formatRemainingDuration,
  isWithinSchedule,
  formatActiveDays,
  bumpAnalytics,
  resolveCheckoutLinks
} = YTFCShared;

const MOON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.353 1.37a6.5 6.5 0 1 0 5.277 8.96A5.76 5.76 0 0 1 9.353 1.37Z"/></svg>`;
const SUN_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="2.8"/><path d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7M3.08 3.08l1.21 1.21M11.71 11.71l1.21 1.21M3.08 12.92l1.21-1.21M11.71 4.29l1.21-1.21"/></svg>`;

const state = {
  settings: { ...DEFAULT_SETTINGS },
  account: { ...DEFAULT_ACCOUNT },
  popupState: { ...DEFAULT_POPUP_STATE },
  session: { ...DEFAULT_SESSION_STATE },
  automation: { ...DEFAULT_AUTOMATION_STATE },
  allowlist: { ...DEFAULT_ALLOWLIST_STATE },
  analytics: { ...DEFAULT_ANALYTICS_STATE },
  theme: null,
  statusTimeoutId: 0,
  noteSaveTimeoutId: 0,
  allowlistSaveTimeoutId: 0,
  sessionTickerId: 0,
  mediaQueryList: null
};

document.addEventListener("DOMContentLoaded", () => {
  void initializePopup();
});

async function initializePopup() {
  const elements = getElements();

  bindEvents(elements);
  await initTheme(elements.themeToggleButton);

  try {
    await loadState();
    applyTheme(state.theme, elements.themeToggleButton);
    render(elements);
  } catch (error) {
    render(elements);
    showStatus(elements.statusElement, error.message || "Could not load settings.", "error", 4200);
  }

  document.body.classList.add("is-ready");

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    let shouldRender = false;

    if (changes[STORAGE_KEYS.settings]) {
      state.settings = sanitizeSettings(changes[STORAGE_KEYS.settings].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.account]) {
      state.account = sanitizeAccount(changes[STORAGE_KEYS.account].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.popupState]) {
      state.popupState = sanitizePopupState(changes[STORAGE_KEYS.popupState].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.session]) {
      state.session = sanitizeSessionState(changes[STORAGE_KEYS.session].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.automation]) {
      state.automation = sanitizeAutomationState(changes[STORAGE_KEYS.automation].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.allowlist]) {
      state.allowlist = sanitizeAllowlistState(changes[STORAGE_KEYS.allowlist].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.analytics]) {
      state.analytics = sanitizeAnalyticsState(changes[STORAGE_KEYS.analytics].newValue);
      shouldRender = true;
    }

    if (changes[STORAGE_KEYS.theme]) {
      state.theme = normalizeTheme(changes[STORAGE_KEYS.theme].newValue);
      applyTheme(state.theme, elements.themeToggleButton);
    }

    if (shouldRender) {
      render(elements);
    }
  });

  state.sessionTickerId = window.setInterval(() => {
    renderSession(elements);
  }, 1000);
}

function getElements() {
  return {
    toggleElements: Array.from(document.querySelectorAll("[data-setting]")),
    profileButtons: Array.from(document.querySelectorAll("[data-profile-button]")),
    dayButtons: Array.from(document.querySelectorAll("[data-day-button]")),
    statusElement: document.getElementById("status-text"),
    planChip: document.getElementById("plan-chip"),
    themeToggleButton: document.getElementById("theme-toggle-button"),
    heroDescription: document.getElementById("hero-description"),
    activeCount: document.getElementById("active-count"),
    planValue: document.getElementById("plan-value"),
    sessionValue: document.getElementById("session-value"),
    focusInput: document.getElementById("focus-intention"),
    focusPreview: document.getElementById("focus-preview"),
    coverageLabel: document.getElementById("coverage-label"),
    coverageBar: document.getElementById("coverage-bar"),
    profilePill: document.getElementById("profile-pill"),
    shieldSummary: document.getElementById("shield-summary"),
    sessionPill: document.getElementById("session-pill"),
    sessionSubtitle: document.getElementById("session-subtitle"),
    sessionCountdown: document.getElementById("session-countdown"),
    sessionButton: document.getElementById("session-button"),
    scheduleSummary: document.getElementById("schedule-summary"),
    scheduleEnabled: document.getElementById("schedule-enabled"),
    scheduleStart: document.getElementById("schedule-start"),
    scheduleEnd: document.getElementById("schedule-end"),
    allowlistInput: document.getElementById("allowlist-input"),
    allowlistCount: document.getElementById("allowlist-count"),
    exportButton: document.getElementById("export-button"),
    importButton: document.getElementById("import-button"),
    importInput: document.getElementById("import-input"),
    analyticsViews: document.getElementById("analytics-views"),
    analyticsAllowlist: document.getElementById("analytics-allowlist"),
    analyticsSnoozes: document.getElementById("analytics-snoozes"),
    analyticsExports: document.getElementById("analytics-exports"),
    monkModeButton: document.getElementById("monk-mode-button"),
    upgradeButton: document.getElementById("upgrade-button"),
    activateButton: document.getElementById("activate-button"),
    donateButton: document.getElementById("donate-button")
  };
}

function bindEvents(elements) {
  elements.toggleElements.forEach((element) => {
    element.addEventListener("change", async () => {
      const settingKey = element.dataset.setting;

      if (PREMIUM_SETTING_KEYS.includes(settingKey) && !state.account.hasPremium) {
        render(elements);
        showStatus(elements.statusElement, "Pro unlocks that shield.", "info");
        return;
      }

      const nextSettings = {
        ...state.settings,
        [settingKey]: element.checked
      };

      await persistState(
        {
          settings: nextSettings,
          popupState: {
            ...state.popupState,
            activeProfile: resolveActiveProfile(nextSettings)
          },
          session: clearSnooze()
        },
        `${SETTING_META[settingKey].label} ${element.checked ? "enabled" : "disabled"}.`,
        elements
      );
    });
  });

  elements.profileButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const profileId = button.dataset.profileButton;
      const nextSettings = {
        ...getProfileSettings(profileId)
      };
      const profile = PROFILE_META[profileId];
      const suffix =
        !state.account.hasPremium &&
        Object.entries(profile.settings).some(([key, enabled]) => PREMIUM_SETTING_KEYS.includes(key) && enabled)
          ? " Pro still controls the locked shields."
          : "";

      await persistState(
        {
          settings: nextSettings,
          popupState: {
            ...state.popupState,
            activeProfile: profileId
          },
          session: clearSnooze(),
          analytics: bumpAnalytics(state.analytics, { profileApplies: 1 })
        },
        `${profile.label} profile applied.${suffix}`,
        elements
      );
    });
  });

  elements.focusInput?.addEventListener("input", () => {
    window.clearTimeout(state.noteSaveTimeoutId);
    showStatus(elements.statusElement, "Saving intention...", "info", 1200);

    state.noteSaveTimeoutId = window.setTimeout(async () => {
      await persistState(
        {
          popupState: {
            ...state.popupState,
            focusNote: elements.focusInput.value.trim()
          }
        },
        "Focus intention saved.",
        elements,
        1800
      );
    }, 220);
  });

  elements.focusInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.focusInput.blur();
    }
  });

  elements.sessionButton?.addEventListener("click", async () => {
    await toggleSnooze(elements);
  });

  elements.scheduleEnabled?.addEventListener("change", async () => {
    await persistState(
      {
        automation: {
          ...state.automation,
          scheduleEnabled: elements.scheduleEnabled.checked
        }
      },
      elements.scheduleEnabled.checked ? "Schedule enabled." : "Schedule disabled.",
      elements
    );
  });

  elements.scheduleStart?.addEventListener("change", async () => {
    await persistScheduleFields(elements, "Start time updated.");
  });

  elements.scheduleEnd?.addEventListener("change", async () => {
    await persistScheduleFields(elements, "End time updated.");
  });

  elements.dayButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const day = Number.parseInt(button.dataset.dayButton, 10);
      const nextDays = state.automation.activeDays.includes(day)
        ? state.automation.activeDays.filter((value) => value !== day)
        : [...state.automation.activeDays, day].sort((left, right) => left - right);

      if (nextDays.length === 0) {
        showStatus(elements.statusElement, "Keep at least one active day.", "info");
        return;
      }

      await persistState(
        {
          automation: {
            ...state.automation,
            activeDays: nextDays
          }
        },
        "Schedule days updated.",
        elements
      );
    });
  });

  elements.allowlistInput?.addEventListener("input", () => {
    window.clearTimeout(state.allowlistSaveTimeoutId);
    showStatus(elements.statusElement, "Saving allowlist...", "info", 1200);

    state.allowlistSaveTimeoutId = window.setTimeout(async () => {
      await persistState(
        {
          allowlist: {
            rules: elements.allowlistInput.value
          }
        },
        "Allowlist saved.",
        elements
      );
    }, 260);
  });

  elements.exportButton?.addEventListener("click", async () => {
    await exportBackup(elements);
  });

  elements.importButton?.addEventListener("click", () => {
    elements.importInput?.click();
  });

  elements.importInput?.addEventListener("change", async () => {
    const [file] = Array.from(elements.importInput.files || []);

    if (!file) {
      return;
    }

    await importBackup(file, elements);
    elements.importInput.value = "";
  });

  elements.monkModeButton?.addEventListener("click", async () => {
    await persistState(
      {
        settings: {
          ...getProfileSettings("deepWork")
        },
        popupState: {
          ...state.popupState,
          activeProfile: "deepWork"
        },
        session: clearSnooze(),
        analytics: bumpAnalytics(state.analytics, { profileApplies: 1 })
      },
      state.account.hasPremium
        ? "Deep Work is live."
        : "Deep Work applied. Pro still controls the locked shields.",
      elements
    );
  });

  elements.upgradeButton?.addEventListener("click", () => {
    if (state.account.hasPremium) {
      return;
    }

    const checkoutLinks = resolveCheckoutLinks(CHECKOUT_CONFIG);

    if (!checkoutLinks.premium.isValid) {
      showStatus(
        elements.statusElement,
        checkoutLinks.premium.reason || "Premium checkout link is not configured correctly.",
        "error",
        4200
      );
      return;
    }

    openExternalLink(checkoutLinks.premium.url);
    showStatus(
      elements.statusElement,
      checkoutLinks.premium.usesPayPalMe
        ? "PayPal.Me opened in a new tab."
        : "Checkout opened in a new tab.",
      "success"
    );
  });

  elements.activateButton?.addEventListener("click", async () => {
    if (state.account.hasPremium) {
      return;
    }

    await persistState(
      {
        account: {
          ...state.account,
          hasPremium: true,
          activatedAt: new Date().toISOString()
        }
      },
      "Premium unlocked on this browser.",
      elements
    );
  });

  elements.donateButton?.addEventListener("click", () => {
    const checkoutLinks = resolveCheckoutLinks(CHECKOUT_CONFIG);

    if (!checkoutLinks.donation.isValid) {
      showStatus(
        elements.statusElement,
        checkoutLinks.donation.reason || "Support link is not configured correctly.",
        "error",
        4200
      );
      return;
    }

    openExternalLink(checkoutLinks.donation.url);
    showStatus(elements.statusElement, "Support link opened. Thank you.", "success");
  });

  document.addEventListener("keydown", async (event) => {
    const isTypingTarget =
      event.target instanceof HTMLElement &&
      (event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA" ||
        event.target.isContentEditable);

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.code === "Slash" && !isTypingTarget) {
      event.preventDefault();
      elements.focusInput?.focus();
      elements.focusInput?.select();
      return;
    }

    if (isTypingTarget) {
      return;
    }

    if (event.code.startsWith("Digit")) {
      const index = Number.parseInt(event.code.replace("Digit", ""), 10) - 1;
      const toggle = elements.toggleElements[index];

      if (toggle) {
        toggle.click();
      }

      return;
    }

    if (event.code === "KeyS") {
      await toggleSnooze(elements);
      return;
    }

    if (event.code === "KeyM") {
      elements.monkModeButton?.click();
    }
  });
}

async function loadState() {
  const rawState = await storageGet(Object.values(STORAGE_KEYS));
  const normalized = normalizeStoredState(rawState);

  state.settings = normalized.settings;
  state.account = normalized.account;
  state.popupState = normalized.popupState;
  state.session = normalized.session;
  state.automation = normalized.automation;
  state.allowlist = normalized.allowlist;
  state.analytics = normalized.analytics;
  state.theme = normalizeTheme(rawState[STORAGE_KEYS.theme]);

  if (Object.keys(normalized.nextState).length > 0) {
    await storageSet(normalized.nextState);
  }
}

async function persistState(nextPartialState, successMessage, elements, statusDuration = 2400) {
  const previousState = {
    settings: state.settings,
    account: state.account,
    popupState: state.popupState,
    session: state.session,
    automation: state.automation,
    allowlist: state.allowlist,
    analytics: state.analytics
  };
  const nextSettings = nextPartialState.settings
    ? sanitizeSettings(nextPartialState.settings)
    : state.settings;
  const nextAccount = nextPartialState.account
    ? sanitizeAccount(nextPartialState.account)
    : state.account;
  const nextPopupState = nextPartialState.popupState
    ? sanitizePopupState(nextPartialState.popupState)
    : state.popupState;
  const nextSession = nextPartialState.session
    ? sanitizeSessionState(nextPartialState.session)
    : state.session;
  const nextAutomation = nextPartialState.automation
    ? sanitizeAutomationState(nextPartialState.automation)
    : state.automation;
  const nextAllowlist = nextPartialState.allowlist
    ? sanitizeAllowlistState(nextPartialState.allowlist)
    : state.allowlist;
  const nextAnalytics = nextPartialState.analytics
    ? sanitizeAnalyticsState(nextPartialState.analytics)
    : state.analytics;
  const updates = {};

  if (nextPartialState.settings) {
    updates[STORAGE_KEYS.settings] = nextSettings;
  }

  if (nextPartialState.account) {
    updates[STORAGE_KEYS.account] = nextAccount;
  }

  if (nextPartialState.popupState) {
    updates[STORAGE_KEYS.popupState] = nextPopupState;
  }

  if (nextPartialState.session) {
    updates[STORAGE_KEYS.session] = nextSession;
  }

  if (nextPartialState.automation) {
    updates[STORAGE_KEYS.automation] = nextAutomation;
  }

  if (nextPartialState.allowlist) {
    updates[STORAGE_KEYS.allowlist] = nextAllowlist;
  }

  if (nextPartialState.analytics) {
    updates[STORAGE_KEYS.analytics] = nextAnalytics;
  }

  state.settings = nextSettings;
  state.account = nextAccount;
  state.popupState = nextPopupState;
  state.session = nextSession;
  state.automation = nextAutomation;
  state.allowlist = nextAllowlist;
  state.analytics = nextAnalytics;
  render(elements);

  try {
    await storageSet(updates);
    showStatus(elements.statusElement, successMessage, "success", statusDuration);
  } catch (error) {
    state.settings = previousState.settings;
    state.account = previousState.account;
    state.popupState = previousState.popupState;
    state.session = previousState.session;
    state.automation = previousState.automation;
    state.allowlist = previousState.allowlist;
    state.analytics = previousState.analytics;
    render(elements);
    showStatus(elements.statusElement, error.message || "Could not save changes.", "error", 4200);
  }
}

function render(elements) {
  const withinSchedule = isWithinSchedule(state.automation);
  const baseEffectiveSettings = getEffectiveSettings(state.settings, state.account, state.session);
  const effectiveSettings = withinSchedule
    ? baseEffectiveSettings
    : Object.fromEntries(Object.keys(baseEffectiveSettings).map((key) => [key, false]));
  const checkoutLinks = resolveCheckoutLinks(CHECKOUT_CONFIG);
  const isPremium = state.account.hasPremium;
  const activeShieldCount = countActiveShields(effectiveSettings);
  const coveragePercent = Math.round(
    (activeShieldCount / Object.keys(DEFAULT_SETTINGS).length) * 100
  );
  const resolvedProfileId =
    state.popupState.activeProfile !== "custom"
      ? state.popupState.activeProfile
      : resolveActiveProfile(state.settings);
  const currentProfile = PROFILE_META[resolvedProfileId] || null;
  const schedulePaused = state.automation.scheduleEnabled && !withinSchedule;

  document.body.classList.toggle("is-premium", isPremium);
  document.body.classList.toggle("is-snoozed", isSessionSnoozed(state.session));

  if (elements.planChip) {
    elements.planChip.textContent = isPremium ? "Pro" : "Free";
  }

  if (elements.planValue) {
    elements.planValue.textContent = isPremium ? "Pro active" : "Free plan";
  }

  if (elements.sessionValue) {
    elements.sessionValue.textContent = isSessionSnoozed(state.session)
      ? "Paused"
      : schedulePaused
        ? "Scheduled off"
        : "Live";
  }

  if (elements.activeCount) {
    elements.activeCount.textContent = String(activeShieldCount);
  }

  if (elements.focusInput && elements.focusInput.value !== state.popupState.focusNote) {
    elements.focusInput.value = state.popupState.focusNote;
  }

  if (elements.focusPreview) {
    elements.focusPreview.textContent = state.popupState.focusNote
      ? `Current intention: ${state.popupState.focusNote}`
      : "Add a quick intention so the popup and homepage both reinforce why you opened YouTube.";
  }

  if (elements.coverageLabel) {
    elements.coverageLabel.textContent = isSessionSnoozed(state.session)
      ? "Protections are temporarily snoozed"
      : schedulePaused
        ? "Protections are outside the current schedule"
        : `${coveragePercent}% of shields live`;
  }

  if (elements.coverageBar) {
    elements.coverageBar.style.width = `${coveragePercent}%`;
  }

  if (elements.profilePill) {
    elements.profilePill.textContent = currentProfile ? currentProfile.shortLabel : "Custom";
  }

  if (elements.shieldSummary) {
    elements.shieldSummary.textContent = `${activeShieldCount} of ${Object.keys(DEFAULT_SETTINGS).length} armed`;
  }

  if (elements.heroDescription) {
    elements.heroDescription.textContent = getHeroDescription(activeShieldCount, withinSchedule);
  }

  elements.profileButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.profileButton === resolvedProfileId);
  });

  elements.toggleElements.forEach((element) => {
    const settingKey = element.dataset.setting;
    const isLocked = PREMIUM_SETTING_KEYS.includes(settingKey) && !isPremium;
    const card = element.closest("[data-setting-card]");
    const isEnabled = Boolean(effectiveSettings[settingKey]);

    element.checked = isEnabled;
    element.disabled = isLocked;

    if (card) {
      card.classList.toggle("is-locked", isLocked);
      card.classList.toggle("is-on", isEnabled);
    }
  });

  if (elements.scheduleEnabled) {
    elements.scheduleEnabled.checked = state.automation.scheduleEnabled;
  }

  if (elements.scheduleStart && elements.scheduleStart.value !== state.automation.startTime) {
    elements.scheduleStart.value = state.automation.startTime;
  }

  if (elements.scheduleEnd && elements.scheduleEnd.value !== state.automation.endTime) {
    elements.scheduleEnd.value = state.automation.endTime;
  }

  elements.dayButtons.forEach((button) => {
    const day = Number.parseInt(button.dataset.dayButton, 10);
    button.classList.toggle("is-active", state.automation.activeDays.includes(day));
  });

  if (elements.scheduleSummary) {
    elements.scheduleSummary.textContent = state.automation.scheduleEnabled
      ? `${formatActiveDays(state.automation.activeDays)} - ${state.automation.startTime} to ${state.automation.endTime}${withinSchedule ? " - live now" : " - currently outside window"}`
      : "Focus runs all day until you turn on a schedule.";
  }

  const allowlistText = state.allowlist.rules.join("\n");

  if (elements.allowlistInput && elements.allowlistInput.value !== allowlistText) {
    elements.allowlistInput.value = allowlistText;
  }

  if (elements.allowlistCount) {
    elements.allowlistCount.textContent =
      state.allowlist.rules.length > 0
        ? `${state.allowlist.rules.length} allowlist rule${state.allowlist.rules.length === 1 ? "" : "s"} active.`
        : "No allowlist rules yet.";
  }

  if (elements.analyticsViews) {
    elements.analyticsViews.textContent = String(state.analytics.protectedViews);
  }

  if (elements.analyticsAllowlist) {
    elements.analyticsAllowlist.textContent = String(state.analytics.allowlistHits);
  }

  if (elements.analyticsSnoozes) {
    elements.analyticsSnoozes.textContent = String(state.analytics.snoozeCount);
  }

  if (elements.analyticsExports) {
    elements.analyticsExports.textContent = String(state.analytics.exports + state.analytics.imports);
  }

  if (elements.upgradeButton) {
    elements.upgradeButton.disabled = isPremium || !checkoutLinks.premium.isValid;
    elements.upgradeButton.textContent = isPremium
      ? "Pro Active"
      : checkoutLinks.premium.usesPayPalMe
        ? "Upgrade via PayPal"
        : "Upgrade to Pro";
    elements.upgradeButton.title =
      !isPremium && !checkoutLinks.premium.isValid ? checkoutLinks.premium.reason : "";
  }

  if (elements.activateButton) {
    elements.activateButton.disabled = isPremium;
    elements.activateButton.textContent = isPremium ? "Browser Activated" : "I've Paid - Unlock Here";
  }

  if (elements.donateButton) {
    elements.donateButton.disabled = !checkoutLinks.donation.isValid;
    elements.donateButton.textContent = checkoutLinks.donation.usesPayPalMe
      ? "Support via PayPal"
      : "Support the project";
    elements.donateButton.title = checkoutLinks.donation.isValid ? "" : checkoutLinks.donation.reason;
  }

  renderSession(elements);
}

function renderSession(elements) {
  const snoozed = isSessionSnoozed(state.session);
  const withinSchedule = isWithinSchedule(state.automation);
  const schedulePaused = state.automation.scheduleEnabled && !withinSchedule;
  const remainingMs = getSessionRemainingMs(state.session);

  if (elements.sessionPill) {
    elements.sessionPill.textContent = snoozed ? "Snoozed" : schedulePaused ? "Scheduled off" : "Live";
  }

  if (elements.sessionSubtitle) {
    elements.sessionSubtitle.textContent = snoozed
      ? `Everything resumes in ${formatRemainingDuration(remainingMs)} at ${formatClockTime(
          state.session.snoozedUntil
        )}.`
      : schedulePaused
        ? `Your current schedule is outside its active window, so shields are paused until ${state.automation.startTime}.`
        : "Use snooze when you intentionally want the full site back for a short window.";
  }

  if (elements.sessionCountdown) {
    elements.sessionCountdown.textContent = snoozed
      ? "Shortcut: Alt+Shift+S globally, or press S in this popup."
      : "Shortcuts: / focus note, 1-7 shields, M Deep Work, S snooze.";
  }

  if (elements.sessionButton) {
    elements.sessionButton.textContent = snoozed ? "Resume Shields" : "Snooze 15 Min";
    elements.sessionButton.classList.toggle("is-resume", snoozed);
  }
}

async function toggleSnooze(elements) {
  const snoozed = isSessionSnoozed(state.session);

  await persistState(
    {
      session: snoozed ? clearSnooze() : createSnoozedSession(15),
      analytics: snoozed ? state.analytics : bumpAnalytics(state.analytics, { snoozeCount: 1 })
    },
    snoozed ? "Shields resumed." : "Shields snoozed for 15 minutes.",
    elements
  );
}

async function persistScheduleFields(elements, successMessage) {
  await persistState(
    {
      automation: {
        ...state.automation,
        startTime: elements.scheduleStart?.value || state.automation.startTime,
        endTime: elements.scheduleEnd?.value || state.automation.endTime
      }
    },
    successMessage,
    elements
  );
}

async function exportBackup(elements) {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    popupState: state.popupState,
    automation: state.automation,
    allowlist: state.allowlist,
    theme: state.theme
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `yt-focus-clean-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  await persistState(
    {
      analytics: bumpAnalytics(state.analytics, { exports: 1 })
    },
    "Backup exported.",
    elements
  );
}

async function importBackup(file, elements) {
  try {
    const rawText = await file.text();
    const parsed = JSON.parse(rawText);
    const updates = {
      [STORAGE_KEYS.settings]: sanitizeSettings(parsed.settings),
      [STORAGE_KEYS.popupState]: sanitizePopupState(parsed.popupState),
      [STORAGE_KEYS.automation]: sanitizeAutomationState(parsed.automation),
      [STORAGE_KEYS.allowlist]: sanitizeAllowlistState(parsed.allowlist),
      [STORAGE_KEYS.session]: clearSnooze(),
      [STORAGE_KEYS.analytics]: bumpAnalytics(state.analytics, { imports: 1 })
    };

    if (parsed.theme === "light" || parsed.theme === "dark") {
      updates[STORAGE_KEYS.theme] = parsed.theme;
      state.theme = parsed.theme;
      applyTheme(state.theme, elements.themeToggleButton);
    }

    await storageSet(updates);
    state.settings = updates[STORAGE_KEYS.settings];
    state.popupState = updates[STORAGE_KEYS.popupState];
    state.automation = updates[STORAGE_KEYS.automation];
    state.allowlist = updates[STORAGE_KEYS.allowlist];
    state.session = updates[STORAGE_KEYS.session];
    state.analytics = updates[STORAGE_KEYS.analytics];
    render(elements);
    showStatus(elements.statusElement, "Backup imported.", "success");
  } catch (error) {
    showStatus(elements.statusElement, error.message || "Could not import backup.", "error", 4200);
  }
}

function getHeroDescription(activeShieldCount, withinSchedule) {
  if (isSessionSnoozed(state.session)) {
    return "The extension is temporarily paused, so YouTube behaves normally until your snooze ends or you resume early.";
  }

  if (state.automation.scheduleEnabled && !withinSchedule) {
    return "Your current focus window is off, so shields are paused until the next scheduled block starts.";
  }

  if (activeShieldCount === 0) {
    return "Nothing is blocked right now. Pick a profile or arm the individual shields you want.";
  }

  if (activeShieldCount === Object.keys(DEFAULT_SETTINGS).length && state.account.hasPremium) {
    return "Deep Work is fully armed. Home, Shorts, comments, recommendations, and extra nudges all stay quiet.";
  }

  if (!state.account.hasPremium) {
    return "Core distractions are lighter already. Pro adds the deeper cleanup and extra automation-friendly shields.";
  }

  return "Your current stack is live. Use schedule windows and the allowlist to make the experience adapt automatically.";
}

async function initTheme(button) {
  if (state.mediaQueryList) {
    return;
  }

  state.mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
  state.mediaQueryList.addEventListener("change", () => {
    if (state.theme === null) {
      applyTheme(null, button);
    }
  });

  applyTheme(state.theme, button);

  button?.addEventListener("click", async () => {
    const nextTheme = isEffectiveDarkTheme() ? "light" : "dark";

    state.theme = nextTheme;
    applyTheme(state.theme, button);

    try {
      await storageSet({
        [STORAGE_KEYS.theme]: nextTheme
      });
    } catch (error) {
      showStatus(
        document.getElementById("status-text"),
        error.message || "Could not switch theme.",
        "error",
        4200
      );
    }
  });
}

function normalizeTheme(value) {
  return value === "light" || value === "dark" ? value : null;
}

function applyTheme(theme, button) {
  document.body.classList.remove("theme-light", "theme-dark");

  if (theme === "light") {
    document.body.classList.add("theme-light");
  }

  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  }

  if (!button) {
    return;
  }

  const effectiveDark = isEffectiveDarkTheme(theme);
  button.innerHTML = effectiveDark ? SUN_SVG : MOON_SVG;
  button.setAttribute("aria-label", effectiveDark ? "Switch to light mode" : "Switch to dark mode");
}

function isEffectiveDarkTheme(theme = state.theme) {
  return theme === "dark" || (theme === null && Boolean(state.mediaQueryList?.matches));
}

function showStatus(statusElement, message, tone = "success", duration = 2400) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.add("is-visible");
  statusElement.classList.toggle("is-success", tone === "success");
  statusElement.classList.toggle("is-error", tone === "error");
  statusElement.classList.toggle("is-info", tone === "info");

  window.clearTimeout(state.statusTimeoutId);
  state.statusTimeoutId = window.setTimeout(() => {
    statusElement.textContent = "";
    statusElement.classList.remove("is-visible", "is-success", "is-error", "is-info");
  }, duration);
}

function openExternalLink(url) {
  chrome.tabs.create({ url });
}
