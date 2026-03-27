const STORAGE_KEY = "ytFocusCleanSettings";
const ACCOUNT_KEY = "ytFocusCleanAccount";
const THEME_KEY = "ytFocusCleanTheme";
const POPUP_STATE_KEY = "ytFocusCleanPopupState";

const MOON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.353 1.37a6.5 6.5 0 1 0 5.277 8.96A5.76 5.76 0 0 1 9.353 1.37Z"/></svg>`;
const SUN_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="2.8"/><path d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7M3.08 3.08l1.21 1.21M11.71 11.71l1.21 1.21M3.08 12.92l1.21-1.21M11.71 4.29l1.21-1.21"/></svg>`;

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

const DEFAULT_POPUP_STATE = {
  focusNote: "",
  sessionPreset: "flow"
};

const PREMIUM_SETTING_KEYS = ["hideComments", "hideSidebar"];

const SETTING_META = {
  hideHomeFeed: {
    label: "Homepage feed"
  },
  hideShorts: {
    label: "Shorts"
  },
  hideComments: {
    label: "Comments"
  },
  hideSidebar: {
    label: "Sidebar recommendations"
  }
};

const PRESET_META = {
  sprint: { label: "Sprint 30" },
  flow: { label: "Flow 60" },
  always: { label: "Always on" }
};

const CHECKOUT_CONFIG = {
  preferredCheckoutUrl: "",
  fallbackPremiumUrl: "https://paypal.me/TiniFlegar/10EUR",
  donationUrl: "https://paypal.me/TiniFlegar"
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  account: { ...DEFAULT_ACCOUNT },
  popupState: { ...DEFAULT_POPUP_STATE },
  statusTimeoutId: null,
  noteSaveTimeoutId: null
};

document.addEventListener("DOMContentLoaded", initializePopup);

function initializePopup() {
  const elements = {
    toggleElements: Array.from(document.querySelectorAll("[data-setting]")),
    presetButtons: Array.from(document.querySelectorAll("[data-preset-button]")),
    statusElement: document.getElementById("status-text"),
    planChip: document.getElementById("plan-chip"),
    planValue: document.getElementById("plan-value"),
    heroDescription: document.getElementById("hero-description"),
    activeCount: document.getElementById("active-count"),
    coverageLabel: document.getElementById("coverage-label"),
    coverageBar: document.getElementById("coverage-bar"),
    presetLabel: document.getElementById("preset-label"),
    shieldSummary: document.getElementById("shield-summary"),
    monkModeButton: document.getElementById("monk-mode-button"),
    upgradeButton: document.getElementById("upgrade-button"),
    activateButton: document.getElementById("activate-button"),
    donateButton: document.getElementById("donate-button"),
    themeToggleButton: document.getElementById("theme-toggle-button"),
    focusInput: document.getElementById("focus-intention")
  };

  initTheme(elements.themeToggleButton);
  bindEvents(elements);

  loadStoredState((settings, account, popupState) => {
    state.settings = settings;
    state.account = account;
    state.popupState = popupState;
    render(elements);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    let shouldRender = false;

    if (changes[STORAGE_KEY]) {
      state.settings = sanitizeSettings(changes[STORAGE_KEY].newValue);
      shouldRender = true;
    }

    if (changes[ACCOUNT_KEY]) {
      state.account = sanitizeAccount(changes[ACCOUNT_KEY].newValue);
      shouldRender = true;
    }

    if (changes[POPUP_STATE_KEY]) {
      state.popupState = sanitizePopupState(changes[POPUP_STATE_KEY].newValue);
      shouldRender = true;
    }

    if (shouldRender) {
      render(elements);
    }
  });
}

function bindEvents(elements) {
  elements.toggleElements.forEach((element) => {
    element.addEventListener("change", () => {
      const settingKey = element.dataset.setting;

      if (PREMIUM_SETTING_KEYS.includes(settingKey) && !state.account.hasPremium) {
        render(elements);
        showStatus(elements.statusElement, "Upgrade to Pro to unlock that shield.");
        return;
      }

      updateSettings({ [settingKey]: element.checked }, () => {
        showStatus(
          elements.statusElement,
          `${SETTING_META[settingKey].label} ${element.checked ? "enabled" : "disabled"}.`
        );
      });
    });
  });

  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const presetKey = button.dataset.presetButton;
      updatePopupState({ sessionPreset: presetKey }, () => {
        showStatus(elements.statusElement, `${PRESET_META[presetKey].label} ready.`);
      });
    });
  });

  elements.focusInput?.addEventListener("input", () => {
    window.clearTimeout(state.noteSaveTimeoutId);
    state.noteSaveTimeoutId = window.setTimeout(() => {
      updatePopupState({ focusNote: elements.focusInput.value }, () => {
        showStatus(elements.statusElement, "Focus intention saved.");
      });
    }, 180);
  });

  elements.focusInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.focusInput.blur();
    }
  });

  elements.monkModeButton?.addEventListener("click", () => {
    const allOn = {
      hideHomeFeed: true,
      hideShorts: true,
      hideComments: true,
      hideSidebar: true
    };

    const freeOn = {
      hideHomeFeed: true,
      hideShorts: true
    };

    updateSettings(state.account.hasPremium ? allOn : freeOn, () => {
      showStatus(
        elements.statusElement,
        state.account.hasPremium
          ? "Full Monk Mode enabled."
          : "Core Monk Mode enabled. Pro unlocks the full stack."
      );
    });
  });

  elements.upgradeButton?.addEventListener("click", () => {
    if (state.account.hasPremium) {
      return;
    }

    const checkoutUrl = CHECKOUT_CONFIG.preferredCheckoutUrl || CHECKOUT_CONFIG.fallbackPremiumUrl;
    openExternalLink(checkoutUrl);
    showStatus(elements.statusElement, "Premium checkout opened.");
  });

  elements.activateButton?.addEventListener("click", () => {
    if (state.account.hasPremium) {
      return;
    }

    updateAccount(
      {
        hasPremium: true,
        billingCycle: "monthly",
        activatedAt: new Date().toISOString()
      },
      () => {
        showStatus(elements.statusElement, "Premium unlocked on this browser.");
      }
    );
  });

  elements.donateButton?.addEventListener("click", () => {
    openExternalLink(CHECKOUT_CONFIG.donationUrl);
    showStatus(elements.statusElement, "Thanks for supporting the project.");
  });
}

function render(elements) {
  const effectiveSettings = getEffectiveSettings(state.settings, state.account);
  const isPremium = state.account.hasPremium;
  const totalShields = Object.keys(DEFAULT_SETTINGS).length;
  const activeShieldCount = Object.values(effectiveSettings).filter(Boolean).length;
  const coveragePercent = Math.round((activeShieldCount / totalShields) * 100);
  const preset = PRESET_META[state.popupState.sessionPreset];

  document.body.classList.toggle("is-premium", isPremium);

  if (elements.planChip) {
    elements.planChip.textContent = isPremium ? "Pro" : "Free";
  }

  if (elements.planValue) {
    elements.planValue.textContent = isPremium ? "Pro" : "Free";
  }

  if (elements.activeCount) {
    elements.activeCount.textContent = String(activeShieldCount);
  }

  if (elements.shieldSummary) {
    elements.shieldSummary.textContent = `${activeShieldCount} of ${totalShields} armed`;
  }

  if (elements.coverageLabel) {
    elements.coverageLabel.textContent = `${coveragePercent}% protected`;
  }

  if (elements.coverageBar) {
    elements.coverageBar.style.width = `${coveragePercent}%`;
  }

  if (elements.presetLabel) {
    elements.presetLabel.textContent = preset ? preset.label : PRESET_META.flow.label;
  }

  if (elements.heroDescription) {
    elements.heroDescription.textContent = getHeroDescription(activeShieldCount, isPremium);
  }

  if (elements.upgradeButton) {
    elements.upgradeButton.disabled = isPremium;
    elements.upgradeButton.textContent = isPremium ? "Pro Active" : "Open Checkout";
  }

  if (elements.activateButton) {
    elements.activateButton.disabled = isPremium;
    elements.activateButton.textContent = isPremium ? "Premium Active" : "Unlock on This Browser";
  }

  if (elements.focusInput && elements.focusInput.value !== state.popupState.focusNote) {
    elements.focusInput.value = state.popupState.focusNote;
  }

  elements.presetButtons.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.presetButton === state.popupState.sessionPreset
    );
  });

  elements.toggleElements.forEach((element) => {
    const settingKey = element.dataset.setting;
    const isLocked = PREMIUM_SETTING_KEYS.includes(settingKey) && !isPremium;
    const card = element.closest("[data-setting-card]");

    element.checked = Boolean(effectiveSettings[settingKey]);
    element.disabled = isLocked;

    if (card) {
      card.classList.toggle("is-locked", isLocked);
    }
  });

  if (elements.statusElement && !elements.statusElement.classList.contains("is-saved")) {
    elements.statusElement.textContent = "";
  }
}

function loadStoredState(callback) {
  chrome.storage.local.get([STORAGE_KEY, ACCOUNT_KEY, POPUP_STATE_KEY], (result) => {
    const settings = sanitizeSettings(result[STORAGE_KEY]);
    const account = sanitizeAccount(result[ACCOUNT_KEY]);
    const popupState = sanitizePopupState(result[POPUP_STATE_KEY]);
    const nextState = {};

    if (!areSettingsEqual(result[STORAGE_KEY], settings)) {
      nextState[STORAGE_KEY] = settings;
    }

    if (!areAccountsEqual(result[ACCOUNT_KEY], account)) {
      nextState[ACCOUNT_KEY] = account;
    }

    if (!arePopupStatesEqual(result[POPUP_STATE_KEY], popupState)) {
      nextState[POPUP_STATE_KEY] = popupState;
    }

    if (Object.keys(nextState).length === 0) {
      callback(settings, account, popupState);
      return;
    }

    chrome.storage.local.set(nextState, () => {
      callback(settings, account, popupState);
    });
  });
}

function updateSettings(partialSettings, callback) {
  const nextSettings = { ...state.settings, ...partialSettings };
  state.settings = sanitizeSettings(nextSettings);
  chrome.storage.local.set({ [STORAGE_KEY]: state.settings }, callback);
}

function updateAccount(partialAccount, callback) {
  const nextAccount = { ...state.account, ...partialAccount };
  state.account = sanitizeAccount(nextAccount);
  chrome.storage.local.set({ [ACCOUNT_KEY]: state.account }, callback);
}

function updatePopupState(partialPopupState, callback) {
  const nextPopupState = { ...state.popupState, ...partialPopupState };
  state.popupState = sanitizePopupState(nextPopupState);
  chrome.storage.local.set({ [POPUP_STATE_KEY]: state.popupState }, callback);
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
  nextPopupState.sessionPreset = PRESET_META[rawPopupState.sessionPreset]
    ? rawPopupState.sessionPreset
    : DEFAULT_POPUP_STATE.sessionPreset;

  return nextPopupState;
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

function arePopupStatesEqual(rawPopupState, normalizedPopupState) {
  if (!rawPopupState || typeof rawPopupState !== "object") {
    return false;
  }

  return (
    rawPopupState.focusNote === normalizedPopupState.focusNote &&
    rawPopupState.sessionPreset === normalizedPopupState.sessionPreset
  );
}

function getEffectiveSettings(settings, account) {
  const effectiveSettings = { ...settings };

  if (!account.hasPremium) {
    PREMIUM_SETTING_KEYS.forEach((key) => {
      effectiveSettings[key] = false;
    });
  }

  return effectiveSettings;
}

function getHeroDescription(activeShieldCount, isPremium) {
  if (activeShieldCount === 4 && isPremium) {
    return "Your full focus stack is armed. YouTube opens quiet, controlled, and intentionally minimal.";
  }

  if (activeShieldCount === 0) {
    return "Everything is currently visible. Arm the shields you want and shape YouTube into a calmer workspace.";
  }

  if (isPremium) {
    return "Core distractions are muted. Fine-tune the stack below until the surface feels effortless to use.";
  }

  return "Core distractions are already lighter. Pro adds comments and sidebar blocking for a fully quiet watch flow.";
}

function initTheme(button) {
  chrome.storage.local.get([THEME_KEY], (result) => {
    applyTheme(result[THEME_KEY] || null, button);
  });

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const forcedDark = document.body.classList.contains("theme-dark");
    const forcedLight = document.body.classList.contains("theme-light");
    const effectiveIsDark = forcedDark || (!forcedLight && systemIsDark);
    const nextTheme = effectiveIsDark ? "light" : "dark";

    chrome.storage.local.set({ [THEME_KEY]: nextTheme }, () => {
      applyTheme(nextTheme, button);
    });
  });
}

function applyTheme(theme, button) {
  document.body.classList.remove("theme-light", "theme-dark");

  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else if (theme === "light") {
    document.body.classList.add("theme-light");
  }

  if (!button) {
    return;
  }

  const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effectiveIsDark = theme === "dark" || (theme === null && systemIsDark);
  button.innerHTML = effectiveIsDark ? SUN_SVG : MOON_SVG;
  button.setAttribute(
    "aria-label",
    effectiveIsDark ? "Switch to light mode" : "Switch to dark mode"
  );
}

function showStatus(statusElement, message) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.add("is-saved");

  window.clearTimeout(state.statusTimeoutId);
  state.statusTimeoutId = window.setTimeout(() => {
    statusElement.textContent = "";
    statusElement.classList.remove("is-saved");
  }, 2200);
}

function openExternalLink(url) {
  chrome.tabs.create({ url });
}
