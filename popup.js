const STORAGE_KEY = "ytFocusCleanSettings";
const ACCOUNT_KEY = "ytFocusCleanAccount";
const THEME_KEY = "ytFocusCleanTheme";

const MOON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 1.5a6.5 6.5 0 1 0 8.5 8.5A5 5 0 0 1 6 1.5z"/></svg>`;
const SUN_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"/></svg>`;

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

const SETTING_LABELS = {
  hideHomeFeed: "Homepage feed",
  hideShorts: "Shorts",
  hideComments: "Comments",
  hideSidebar: "Sidebar"
};

const CHECKOUT_CONFIG = {
  preferredCheckoutUrl: "",
  fallbackPremiumUrl: "https://paypal.me/TiniFlegar/10EUR",
  donationUrl: "https://paypal.me/TiniFlegar"
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  account: { ...DEFAULT_ACCOUNT },
  statusTimeoutId: null
};

document.addEventListener("DOMContentLoaded", initializePopup);

function initializePopup() {
  const elements = {
    toggleElements: Array.from(document.querySelectorAll("[data-setting]")),
    statusElement: document.getElementById("status-text"),
    planChip: document.getElementById("plan-chip"),
    monkModeButton: document.getElementById("monk-mode-button"),
    upgradeButton: document.getElementById("upgrade-button"),
    activateButton: document.getElementById("activate-button"),
    donateButton: document.getElementById("donate-button"),
    themeToggleButton: document.getElementById("theme-toggle-button")
  };

  initTheme(elements.themeToggleButton);
  bindEvents(elements);

  loadStoredState((settings, account) => {
    state.settings = settings;
    state.account = account;
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
        showStatus(elements.statusElement, "Upgrade to Pro to unlock this.");
        return;
      }

      updateSettings({ [settingKey]: element.checked }, () => {
        showStatus(
          elements.statusElement,
          `${SETTING_LABELS[settingKey]} ${element.checked ? "on" : "off"}.`
        );
      });
    });
  });

  elements.monkModeButton?.addEventListener("click", () => {
    const allOn = {
      hideHomeFeed: true,
      hideShorts: true,
      hideComments: true,
      hideSidebar: true
    };
    const freeOn = { hideHomeFeed: true, hideShorts: true };
    const isPremium = state.account.hasPremium;

    updateSettings(isPremium ? allOn : freeOn, () => {
      showStatus(
        elements.statusElement,
        isPremium ? "Monk Mode on." : "Free focus on. Upgrade for full Monk Mode."
      );
    });
  });

  elements.upgradeButton?.addEventListener("click", () => {
    if (state.account.hasPremium) {
      return;
    }

    const checkoutUrl = CHECKOUT_CONFIG.preferredCheckoutUrl || CHECKOUT_CONFIG.fallbackPremiumUrl;
    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    showStatus(elements.statusElement, "Opened premium checkout.");
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
    window.open(CHECKOUT_CONFIG.donationUrl, "_blank", "noopener,noreferrer");
    showStatus(elements.statusElement, "Thanks for the support!");
  });
}

function render(elements) {
  const effectiveSettings = getEffectiveSettings(state.settings, state.account);
  const isPremium = state.account.hasPremium;

  document.body.classList.toggle("is-premium", isPremium);

  if (elements.planChip) {
    elements.planChip.textContent = isPremium ? "Pro" : "Free";
  }

  if (elements.upgradeButton) {
    elements.upgradeButton.disabled = isPremium;
    elements.upgradeButton.textContent = isPremium ? "Pro Active" : "Open Checkout";
  }

  if (elements.activateButton) {
    elements.activateButton.disabled = isPremium;
    elements.activateButton.textContent = isPremium ? "Premium Unlocked" : "I've Paid - Unlock Here";
  }

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

function getEffectiveSettings(settings, account) {
  const effectiveSettings = { ...settings };

  if (!account.hasPremium) {
    PREMIUM_SETTING_KEYS.forEach((key) => {
      effectiveSettings[key] = false;
    });
  }

  return effectiveSettings;
}

function initTheme(btn) {
  chrome.storage.local.get([THEME_KEY], (result) => {
    applyTheme(result[THEME_KEY] || null, btn);
  });

  if (btn) {
    btn.addEventListener("click", () => {
      const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const forcedDark = document.body.classList.contains("theme-dark");
      const forcedLight = document.body.classList.contains("theme-light");
      const effectiveIsDark = forcedDark || (!forcedLight && systemIsDark);
      const next = effectiveIsDark ? "light" : "dark";
      chrome.storage.local.set({ [THEME_KEY]: next }, () => {
        applyTheme(next, btn);
      });
    });
  }
}

function applyTheme(theme, btn) {
  document.body.classList.remove("theme-light", "theme-dark");
  if (theme === "dark") document.body.classList.add("theme-dark");
  else if (theme === "light") document.body.classList.add("theme-light");

  if (btn) {
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effectiveIsDark = theme === "dark" || (theme === null && systemIsDark);
    btn.innerHTML = effectiveIsDark ? SUN_SVG : MOON_SVG;
    btn.setAttribute("aria-label", effectiveIsDark ? "Switch to light mode" : "Switch to dark mode");
  }
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
