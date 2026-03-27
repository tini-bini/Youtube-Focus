const storedTheme = localStorage.getItem("rd_theme");

if (storedTheme) {
  document.documentElement.dataset.theme = storedTheme;
}

const DEFAULT_SETTINGS = {
  historyDays: 90,
  showBadge: true,
  showInlineLabel: true,
  enableFakeWasDetection: true,
  enablePriceAnchorDetection: true,
  enableUrgencyDetection: true,
  enableRollbackDetection: true,
  enableSubscriptionDetection: true
};

const SETTINGS_BINDINGS = {
  "toggle-badge": "showBadge",
  "toggle-inline-label": "showInlineLabel",
  "toggle-urgency": "enableUrgencyDetection"
};

const SCORE_STYLES = {
  green: { color: "#4ea867", label: "Verified deal" },
  yellow: { color: "#d59a3a", label: "Needs context" },
  red: { color: "#d35f5f", label: "High risk" }
};

const THEME_ICONS = {
  light: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `,
  dark: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" stroke-width="1.8"></circle>
      <path d="M12 2.5V4.5M12 19.5V21.5M21.5 12H19.5M4.5 12H2.5M18.72 5.28L17.3 6.7M6.7 17.3L5.28 18.72M18.72 18.72L17.3 17.3M6.7 6.7L5.28 5.28" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    </svg>
  `
};

const state = {
  activeTabId: null,
  productKey: null,
  currentPrice: null,
  currentCurrency: "USD",
  settings: { ...DEFAULT_SETTINGS },
  targets: {},
  toastTimer: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  syncThemeIcon();
  setView("loading");

  const [storageSnapshot, activeTab] = await Promise.all([
    chrome.storage.local.get(null),
    getActiveTab()
  ]);

  hydrateStorageState(storageSnapshot);
  syncQuickControls();

  await loadPageData(activeTab);
}

function cacheElements() {
  state.elements = {
    themeToggle: document.getElementById("theme-toggle"),
    settingsBtn: document.getElementById("settings-btn"),
    openSettingsBtn: document.getElementById("btn-open-settings"),
    openPanelBtn: document.getElementById("btn-open-panel"),
    toast: document.getElementById("toast"),
    loading: document.getElementById("state-loading"),
    noProduct: document.getElementById("state-no-product"),
    product: document.getElementById("state-product"),
    footerStats: document.getElementById("footer-stats"),
    footerNote: document.getElementById("footer-note"),
    sitePill: document.getElementById("site-pill"),
    historyPill: document.getElementById("history-pill"),
    scoreOrb: document.getElementById("score-orb"),
    scoreValue: document.getElementById("score-value"),
    scoreCat: document.getElementById("score-cat"),
    scoreVerdict: document.getElementById("score-verdict"),
    currentPrice: document.getElementById("current-price"),
    originalPrice: document.getElementById("original-price"),
    lowestPrice: document.getElementById("lowest-price"),
    lowestNote: document.getElementById("lowest-note"),
    discountValue: document.getElementById("discount-value"),
    discountNote: document.getElementById("discount-note"),
    stabilityValue: document.getElementById("stability-value"),
    stabilityNote: document.getElementById("stability-note"),
    productSite: document.getElementById("product-site"),
    productName: document.getElementById("product-name"),
    productSummary: document.getElementById("product-summary"),
    tricksCount: document.getElementById("tricks-count"),
    tricksList: document.getElementById("tricks-list"),
    targetCard: document.getElementById("target-card"),
    targetCurrency: document.getElementById("target-currency"),
    targetPrefix: document.getElementById("target-prefix"),
    targetInput: document.getElementById("target-price-input"),
    targetStatus: document.getElementById("target-status"),
    saveTargetBtn: document.getElementById("save-target-btn"),
    clearTargetBtn: document.getElementById("clear-target-btn"),
    quickToggles: Object.keys(SETTINGS_BINDINGS).reduce((acc, id) => {
      acc[id] = document.getElementById(id);
      return acc;
    }, {})
  };
}

function bindEvents() {
  state.elements.themeToggle.addEventListener("click", toggleTheme);
  state.elements.settingsBtn.addEventListener("click", openSettings);
  state.elements.openSettingsBtn.addEventListener("click", openSettings);
  state.elements.openPanelBtn.addEventListener("click", openFullAnalysis);
  state.elements.saveTargetBtn.addEventListener("click", saveTargetPrice);
  state.elements.clearTargetBtn.addEventListener("click", clearTargetPrice);

  state.elements.targetInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveTargetPrice();
    }
  });

  Object.entries(state.elements.quickToggles).forEach(([id, input]) => {
    input.addEventListener("change", async () => {
      const key = SETTINGS_BINDINGS[id];
      state.settings[key] = input.checked;
      await chrome.storage.local.set({ rd_settings: state.settings });
      showToast("Preference saved");
    });
  });
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("rd_theme", next);
  syncThemeIcon();
}

function syncThemeIcon() {
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  state.elements.themeToggle.innerHTML = theme === "dark" ? THEME_ICONS.dark : THEME_ICONS.light;
}

function hydrateStorageState(storageSnapshot) {
  state.settings = { ...DEFAULT_SETTINGS, ...(storageSnapshot.rd_settings || {}) };
  state.targets = storageSnapshot.rd_popup_targets || {};

  const trackedEntries = Object.entries(storageSnapshot).filter(([key]) => key.startsWith("rd_p_"));
  const observationCount = trackedEntries.reduce((sum, [, record]) => sum + (record.history?.length || 0), 0);

  state.elements.footerStats.textContent = `${trackedEntries.length} tracked`;
  state.elements.footerNote.textContent = `${observationCount} local price observation${observationCount === 1 ? "" : "s"} stored privately.`;
}

function syncQuickControls() {
  Object.entries(SETTINGS_BINDINGS).forEach(([id, key]) => {
    state.elements.quickToggles[id].checked = Boolean(state.settings[key]);
  });
}

async function loadPageData(tab) {
  state.activeTabId = tab?.id || null;

  if (!state.activeTabId) {
    disableProductTools("Open a supported product page to save a target price.");
    setView("no-product");
    return;
  }

  let response = null;

  try {
    response = await chrome.tabs.sendMessage(state.activeTabId, { type: "RD_GET_PAGE_DATA" });
  } catch {
    response = null;
  }

  if (!response?.scraped || !response?.scoreResult) {
    disableProductTools("Open a supported product page to save a target price.");
    setView("no-product");
    return;
  }

  renderProduct(response);
  setView("product");
}

function renderProduct({ scraped, stored, scoreResult }) {
  const style = SCORE_STYLES[scoreResult.category] || SCORE_STYLES.green;
  const score = clamp(scoreResult.score || 0, 0, 100);
  const productSite = formatSiteName(scraped.site || getHostnameLabel(scraped.productUrl));
  const historyCount = stored?.history?.length || scoreResult.history?.length || 0;

  state.productKey = stored?.productId || buildFallbackProductKey(scraped.productUrl, scraped.name);
  state.currentPrice = scraped.currentPrice ?? null;
  state.currentCurrency = scraped.currency || "USD";

  state.elements.sitePill.textContent = productSite;
  state.elements.historyPill.textContent = historyCount > 0 ? `${historyCount} snapshots` : "Fresh page";
  state.elements.scoreOrb.style.setProperty("--score-color", style.color);
  state.elements.scoreOrb.style.setProperty("--score-progress", String(score));
  state.elements.scoreValue.textContent = String(score);
  state.elements.scoreCat.textContent = style.label;
  state.elements.scoreCat.style.color = style.color;
  state.elements.scoreVerdict.textContent = scoreResult.verdict || "Pricing signals loaded.";

  state.elements.currentPrice.textContent = formatCurrency(scraped.currentPrice, scraped.currency);
  state.elements.originalPrice.textContent = scraped.originalPrice
    ? `Anchor ${formatCurrency(scraped.originalPrice, scraped.currency)}`
    : scraped.isOnSale
      ? "Sale detected"
      : "No anchor price";

  state.elements.lowestPrice.textContent = formatCurrency(scoreResult.lowestEverPrice, scraped.currency);
  state.elements.lowestNote.textContent = scoreResult.lowestEverPrice != null && scraped.currentPrice != null
    ? buildLowestNote(scraped.currentPrice, scoreResult.lowestEverPrice, scraped.currency)
    : "Need more history";

  state.elements.discountValue.textContent = buildDiscountValue(scoreResult);
  state.elements.discountNote.textContent = buildDiscountNote(scoreResult);

  state.elements.stabilityValue.textContent = `${Math.max(scoreResult.daysAtCurrentPrice || 0, 0)}d`;
  state.elements.stabilityNote.textContent = scoreResult.daysTracked > 0
    ? `${scoreResult.daysTracked} days tracked`
    : "Newly tracked";

  state.elements.productSite.textContent = productSite;
  state.elements.productName.textContent = scraped.name || "Current product";
  state.elements.productSummary.textContent = buildProductSummary(scraped, scoreResult, stored);

  renderTricks(scoreResult.tricks || []);
  enableProductTools(scraped);
}

function renderTricks(tricks) {
  state.elements.tricksCount.textContent = `${tricks.length} flag${tricks.length === 1 ? "" : "s"}`;

  if (!tricks.length) {
    state.elements.tricksList.innerHTML = `
      <article class="insight-item">
        <div class="insight-topline">
          <span class="insight-title">No manipulative signals detected</span>
          <span class="soft-pill severity-chip low">Clean</span>
        </div>
        <p class="supporting-text">This listing is not currently showing the pricing tricks RealDeal checks for. More history always sharpens the verdict.</p>
      </article>
    `;
    return;
  }

  state.elements.tricksList.innerHTML = tricks.map((trick) => `
    <article class="insight-item">
      <div class="insight-topline">
        <span class="insight-title">${escapeHtml(trick.label)}</span>
        <span class="soft-pill severity-chip ${escapeHtml(trick.severity)}">${escapeHtml(trick.severity)}</span>
      </div>
      <p class="supporting-text">${escapeHtml(trick.description || trick.label)}</p>
    </article>
  `).join("");
}

function enableProductTools(scraped) {
  const savedTarget = state.targets[state.productKey];
  const currencyCode = scraped.currency || "USD";
  const prefix = currencySymbol(currencyCode);

  state.elements.openPanelBtn.disabled = false;
  state.elements.targetCard.classList.remove("is-disabled");
  state.elements.targetCurrency.textContent = currencyCode;
  state.elements.targetPrefix.textContent = prefix;
  state.elements.targetInput.disabled = false;
  state.elements.saveTargetBtn.disabled = false;
  state.elements.targetInput.placeholder = state.currentPrice != null
    ? Number(state.currentPrice).toFixed(2)
    : "149.00";

  if (typeof savedTarget === "number") {
    state.elements.targetInput.value = savedTarget.toFixed(2);
    state.elements.clearTargetBtn.classList.remove("hidden");
    state.elements.targetStatus.textContent = buildTargetStatus(savedTarget, state.currentPrice, currencyCode);
  } else {
    state.elements.targetInput.value = "";
    state.elements.clearTargetBtn.classList.add("hidden");
    state.elements.targetStatus.textContent = "Save a target and RealDeal will keep your ideal buy price pinned here.";
  }
}

function disableProductTools(message) {
  state.productKey = null;
  state.currentPrice = null;
  state.currentCurrency = "USD";
  state.elements.openPanelBtn.disabled = true;
  state.elements.targetCard.classList.add("is-disabled");
  state.elements.targetCurrency.textContent = "USD";
  state.elements.targetPrefix.textContent = "$";
  state.elements.targetInput.value = "";
  state.elements.targetInput.placeholder = "149.00";
  state.elements.targetInput.disabled = true;
  state.elements.saveTargetBtn.disabled = true;
  state.elements.clearTargetBtn.classList.add("hidden");
  state.elements.targetStatus.textContent = message;
}

async function saveTargetPrice() {
  if (!state.productKey) {
    return;
  }

  const parsedValue = Number.parseFloat(state.elements.targetInput.value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    showToast("Enter a valid target price");
    state.elements.targetInput.focus();
    return;
  }

  state.targets[state.productKey] = roundCurrency(parsedValue);
  await chrome.storage.local.set({ rd_popup_targets: state.targets });
  state.elements.clearTargetBtn.classList.remove("hidden");
  state.elements.targetStatus.textContent = buildTargetStatus(
    state.targets[state.productKey],
    state.currentPrice,
    state.currentCurrency
  );
  showToast("Target price saved");
}

async function clearTargetPrice() {
  if (!state.productKey || typeof state.targets[state.productKey] !== "number") {
    return;
  }

  delete state.targets[state.productKey];
  await chrome.storage.local.set({ rd_popup_targets: state.targets });
  state.elements.targetInput.value = "";
  state.elements.clearTargetBtn.classList.add("hidden");
  state.elements.targetStatus.textContent = "Target removed. Save a new price whenever you want to watch this item again.";
  showToast("Target price cleared");
}

async function openSettings() {
  await chrome.runtime.openOptionsPage();
}

async function openFullAnalysis() {
  if (!state.activeTabId) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(state.activeTabId, { type: "RD_OPEN_PANEL" });
    window.close();
  } catch {
    showToast("The full analysis panel is not available on this tab");
  }
}

function setView(view) {
  state.elements.loading.classList.toggle("hidden", view !== "loading");
  state.elements.noProduct.classList.toggle("hidden", view !== "no-product");
  state.elements.product.classList.toggle("hidden", view !== "product");
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  state.elements.toast.textContent = message;
  state.elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    state.elements.toast.classList.remove("is-visible");
  }, 2200);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function buildLowestNote(currentPrice, lowestPrice, currency) {
  const diff = roundCurrency(currentPrice - lowestPrice);
  if (Math.abs(diff) < 0.01) {
    return "Matching the lowest tracked price";
  }

  return diff > 0
    ? `${formatCurrency(diff, currency)} above the low`
    : `${formatCurrency(Math.abs(diff), currency)} below the low`;
}

function buildDiscountValue(scoreResult) {
  if (scoreResult.trueDiscountPct != null) {
    return `${Math.round(scoreResult.trueDiscountPct)}% real`;
  }

  if (scoreResult.claimedDiscountPct != null) {
    return `${Math.round(scoreResult.claimedDiscountPct)}% claimed`;
  }

  return "Live only";
}

function buildDiscountNote(scoreResult) {
  if (scoreResult.trueDiscountPct != null && scoreResult.claimedDiscountPct != null) {
    const gap = Math.round(scoreResult.claimedDiscountPct - scoreResult.trueDiscountPct);
    if (gap > 0) {
      return `${gap}% gap vs claimed sale`;
    }
  }

  if (scoreResult.trueDiscountPct != null) {
    return "Measured against tracked peaks";
  }

  if (scoreResult.claimedDiscountPct != null) {
    return "No history to verify yet";
  }

  return "No explicit discount detected";
}

function buildProductSummary(scraped, scoreResult, stored) {
  const fragments = [];
  const historyCount = stored?.history?.length || scoreResult.history?.length || 0;

  if (scraped.currentPrice != null) {
    fragments.push(`Currently ${formatCurrency(scraped.currentPrice, scraped.currency)}`);
  }

  if (scoreResult.lowestEverPrice != null && historyCount > 1) {
    fragments.push(`best tracked at ${formatCurrency(scoreResult.lowestEverPrice, scraped.currency)}`);
  }

  if (scoreResult.daysTracked > 0) {
    fragments.push(`watched for ${scoreResult.daysTracked} days`);
  } else {
    fragments.push("just started tracking");
  }

  return fragments.join(" | ");
}

function buildTargetStatus(targetPrice, currentPrice, currency) {
  if (currentPrice == null) {
    return `Saved for ${formatCurrency(targetPrice, currency)}.`;
  }

  const delta = roundCurrency(currentPrice - targetPrice);

  if (delta <= 0) {
    return `Current price is ${formatCurrency(Math.abs(delta), currency)} below your target of ${formatCurrency(targetPrice, currency)}.`;
  }

  return `Needs ${formatCurrency(delta, currency)} more downside to hit your ${formatCurrency(targetPrice, currency)} target.`;
}

function formatCurrency(amount, currency = "USD") {
  if (amount == null || Number.isNaN(Number(amount))) {
    return "--";
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currencySymbol(currency)}${Number(amount).toFixed(2)}`;
  }
}

function currencySymbol(currency) {
  return {
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
    CAD: "C$",
    AUD: "A$",
    INR: "\u20B9",
    JPY: "\u00A5",
    CHF: "Fr"
  }[currency] || `${currency} `;
}

function formatSiteName(raw) {
  if (!raw) {
    return "Supported store";
  }

  return String(raw)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getHostnameLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "store";
  }
}

function buildFallbackProductKey(url, name) {
  return `popup_${hashString(`${normalizeUrl(url)}|${(name || "").toLowerCase().trim().slice(0, 120)}`)}`;
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url || "");
    const keepParams = ["id", "productid", "asin", "item", "sku", "gtin", "article"];
    const params = new URLSearchParams();

    parsed.searchParams.forEach((value, key) => {
      if (keepParams.includes(key.toLowerCase())) {
        params.set(key, value);
      }
    });

    const query = params.toString();
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return url || "";
  }
}

function hashString(value) {
  let hash = 2166136261 >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
