const {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  THEME_ICONS,
  toggleTheme: toggleSharedTheme,
  resolveTheme,
  getStorageStats
} = RealDealShared;
const { getSupportDestinations } = RealDealPayPal;

const TOGGLE_IDS = [
  "showBadge",
  "showInlineLabel",
  "enableFakeWasDetection",
  "enablePriceAnchorDetection",
  "enableUrgencyDetection",
  "enableRollbackDetection",
  "enableSubscriptionDetection"
];

const state = {
  savedSettings: { ...DEFAULT_SETTINGS },
  toastTimer: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  syncThemeIcon();

  await Promise.all([
    loadSettings(),
    refreshStats()
  ]);

  renderPayPalStatus();
  syncDirtyState(false);
}

function cacheElements() {
  const byId = (id) => document.getElementById(id);

  state.elements = {
    themeToggle: byId("theme-toggle"),
    historyDays: byId("historyDays"),
    historyDaysValue: byId("historyDays-val"),
    retentionNote: byId("retention-note"),
    saveStatus: byId("save-status"),
    saveButton: byId("btn-save"),
    resetButton: byId("btn-reset"),
    exportButton: byId("btn-export"),
    exportJsonButton: byId("btn-export-json"),
    importJsonButton: byId("btn-import-json"),
    importJsonInput: byId("import-json-input"),
    clearButton: byId("btn-clear"),
    confirmOverlay: byId("confirm-overlay"),
    confirmCancel: byId("confirm-cancel"),
    confirmOk: byId("confirm-ok"),
    statProducts: byId("stat-products"),
    statObs: byId("stat-obs"),
    toast: byId("toast"),
    paypalStatus: byId("paypal-status"),
    paypalList: byId("paypal-list"),
    presetButtons: Array.from(document.querySelectorAll(".preset-btn")),
    controls: TOGGLE_IDS.reduce((accumulator, id) => {
      accumulator[id] = byId(id);
      return accumulator;
    }, {})
  };
}

function bindEvents() {
  state.elements.themeToggle.addEventListener("click", () => {
    toggleSharedTheme();
    syncThemeIcon();
  });

  state.elements.historyDays.addEventListener("input", () => {
    updateHistoryLabel();
    syncPresetState();
    syncDirtyState();
  });

  state.elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.elements.historyDays.value = button.dataset.days;
      updateHistoryLabel();
      syncPresetState();
      syncDirtyState();
    });
  });

  Object.values(state.elements.controls).forEach((input) => {
    input.addEventListener("change", () => syncDirtyState());
  });

  state.elements.saveButton.addEventListener("click", saveSettings);
  state.elements.resetButton.addEventListener("click", resetForm);
  state.elements.exportButton.addEventListener("click", exportCsv);
  state.elements.exportJsonButton.addEventListener("click", exportJson);
  state.elements.importJsonButton.addEventListener("click", () => state.elements.importJsonInput.click());
  state.elements.importJsonInput.addEventListener("change", importJson);
  state.elements.clearButton.addEventListener("click", openConfirmDialog);
  state.elements.confirmCancel.addEventListener("click", closeConfirmDialog);
  state.elements.confirmOk.addEventListener("click", clearHistory);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveSettings();
    }

    if (event.key === "Escape" && !state.elements.confirmOverlay.classList.contains("hidden")) {
      closeConfirmDialog();
    }
  });

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEYS.settings] && !isDirty()) {
      state.savedSettings = {
        ...DEFAULT_SETTINGS,
        ...(changes[STORAGE_KEYS.settings].newValue || {})
      };
      applySettingsToForm(state.savedSettings);
      syncDirtyState(false);
    }

    if (Object.keys(changes).some((key) => key.startsWith(STORAGE_KEYS.productPrefix))) {
      await refreshStats();
    }
  });
}

async function loadSettings() {
  const snapshot = await chrome.storage.local.get(STORAGE_KEYS.settings);
  state.savedSettings = {
    ...DEFAULT_SETTINGS,
    ...(snapshot[STORAGE_KEYS.settings] || {})
  };

  applySettingsToForm(state.savedSettings);
}

function applySettingsToForm(settings) {
  state.elements.historyDays.value = settings.historyDays;
  updateHistoryLabel();

  TOGGLE_IDS.forEach((id) => {
    state.elements.controls[id].checked = Boolean(settings[id]);
  });

  syncPresetState();
}

function collectFormSettings() {
  return {
    historyDays: Number.parseInt(state.elements.historyDays.value, 10),
    showBadge: state.elements.controls.showBadge.checked,
    showInlineLabel: state.elements.controls.showInlineLabel.checked,
    enableFakeWasDetection: state.elements.controls.enableFakeWasDetection.checked,
    enablePriceAnchorDetection: state.elements.controls.enablePriceAnchorDetection.checked,
    enableUrgencyDetection: state.elements.controls.enableUrgencyDetection.checked,
    enableRollbackDetection: state.elements.controls.enableRollbackDetection.checked,
    enableSubscriptionDetection: state.elements.controls.enableSubscriptionDetection.checked
  };
}

function updateHistoryLabel() {
  const value = Number.parseInt(state.elements.historyDays.value, 10);
  state.elements.historyDaysValue.textContent = `${value} days`;
  state.elements.retentionNote.textContent = value >= 180
    ? "Longer retention gives RealDeal more context for true discounts, fake anchors, and price spikes."
    : value >= 90
      ? "Balanced retention keeps the extension lightweight while still improving trust-score accuracy."
      : "Short retention trims storage faster, but you may lose long-term pricing context.";
}

function syncPresetState() {
  const current = String(state.elements.historyDays.value);
  state.elements.presetButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.days === current);
  });
}

function isDirty() {
  const current = JSON.stringify(collectFormSettings());
  const saved = JSON.stringify(state.savedSettings);
  return current !== saved;
}

function syncDirtyState(forceValue) {
  const dirty = typeof forceValue === "boolean" ? forceValue : isDirty();

  state.elements.saveButton.disabled = !dirty;
  state.elements.resetButton.disabled = !dirty;
  state.elements.saveStatus.className = "";

  if (dirty) {
    state.elements.saveStatus.textContent = "Unsaved changes";
    state.elements.saveStatus.classList.add("is-dirty");
  } else {
    state.elements.saveStatus.textContent = "All changes saved";
    state.elements.saveStatus.classList.add("is-success");
  }
}

async function refreshStats() {
  const snapshot = await chrome.storage.local.get(null);
  const stats = getStorageStats(snapshot);
  state.elements.statProducts.textContent = String(stats.trackedProducts);
  state.elements.statObs.textContent = String(stats.observationCount);
}

async function saveSettings() {
  const newSettings = collectFormSettings();

  state.elements.saveButton.disabled = true;
  state.elements.saveStatus.textContent = "Saving changes...";
  state.elements.saveStatus.className = "is-warning";

  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: {
      ...DEFAULT_SETTINGS,
      ...newSettings
    }
  });

  state.savedSettings = {
    ...DEFAULT_SETTINGS,
    ...newSettings
  };

  syncDirtyState(false);
  showToast("Settings saved");
}

function resetForm() {
  applySettingsToForm(state.savedSettings);
  syncDirtyState(false);
  showToast("Changes reset");
}

async function exportCsv() {
  const all = await chrome.storage.local.get(null);
  const products = Object.entries(all).filter(([key]) => key.startsWith(STORAGE_KEYS.productPrefix));

  if (!products.length) {
    showToast("No price history to export yet");
    return;
  }

  const rows = ["Product Name,Site,Currency,Date,Price,Original Price,Sale %,Is Sale,URL"];

  products.forEach(([, product]) => {
    (product.history || []).forEach((entry) => {
      const date = new Date(entry.timestamp).toISOString().slice(0, 10);
      rows.push([
        csvCell(product.name),
        csvCell(product.site || ""),
        csvCell(product.currency || ""),
        date,
        entry.price?.toFixed(2) ?? "",
        entry.originalPrice?.toFixed(2) ?? "",
        entry.salePercent ?? "",
        entry.isSale ? "yes" : "no",
        csvCell(product.productUrl || "")
      ].join(","));
    });
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `realdeal-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("CSV export ready");
}

async function exportJson() {
  const snapshot = await chrome.storage.local.get(null);
  const payload = {
    exportedAt: new Date().toISOString(),
    version: chrome.runtime.getManifest().version,
    data: Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => {
        return key.startsWith(STORAGE_KEYS.productPrefix) ||
          key === STORAGE_KEYS.settings ||
          key === STORAGE_KEYS.popupTargets;
      })
    )
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `realdeal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("JSON backup ready");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const updates = normalizeImportedData(parsed);

    if (!Object.keys(updates).length) {
      showToast("No RealDeal data found in that file");
      return;
    }

    await chrome.storage.local.set(updates);
    await Promise.all([loadSettings(), refreshStats()]);
    syncDirtyState(false);
    showToast("JSON import complete");
  } catch (error) {
    console.warn("[RealDeal] Failed to import JSON:", error);
    showToast("Import failed. Check the file and try again.");
  } finally {
    state.elements.importJsonInput.value = "";
  }
}

function openConfirmDialog() {
  state.elements.confirmOverlay.classList.remove("hidden");
  state.elements.confirmOverlay.setAttribute("aria-hidden", "false");
  state.elements.confirmOk.focus();
}

function closeConfirmDialog() {
  state.elements.confirmOverlay.classList.add("hidden");
  state.elements.confirmOverlay.setAttribute("aria-hidden", "true");
  state.elements.clearButton.focus();
}

async function clearHistory() {
  const snapshot = await chrome.storage.local.get(null);
  const keys = Object.keys(snapshot).filter((key) => key.startsWith(STORAGE_KEYS.productPrefix));

  if (keys.length) {
    await chrome.storage.local.remove(keys);
  }

  await refreshStats();
  closeConfirmDialog();
  showToast(keys.length ? "Local price history cleared" : "Nothing to clear");
}

function syncThemeIcon() {
  const theme = resolveTheme();
  state.elements.themeToggle.innerHTML = theme === "dark" ? THEME_ICONS.dark : THEME_ICONS.light;
}

function renderPayPalStatus() {
  const links = getSupportDestinations();
  const readyCount = links.filter((entry) => !entry.disabled).length;

  state.elements.paypalStatus.textContent = readyCount ? `${readyCount} valid` : "Unavailable";
  state.elements.paypalList.innerHTML = links.map((entry) => `
    <p>
      <strong>${entry.label}:</strong>
      ${entry.disabled
        ? `${entry.reason}.`
        : `<a href="${entry.url}" target="_blank" rel="noreferrer">${entry.url}</a>`}
    </p>
  `).join("");
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  state.elements.toast.textContent = message;
  state.elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    state.elements.toast.classList.remove("is-visible");
  }, 2200);
}

function normalizeImportedData(parsed) {
  const rawData = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const updates = {};

  Object.entries(rawData || {}).forEach(([key, value]) => {
    if (
      key === STORAGE_KEYS.settings ||
      key === STORAGE_KEYS.popupTargets ||
      key.startsWith(STORAGE_KEYS.productPrefix)
    ) {
      updates[key] = value;
    }
  });

  return updates;
}

function csvCell(value) {
  const normalized = String(value || "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}
