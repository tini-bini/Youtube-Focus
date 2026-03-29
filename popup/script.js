const {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  THEME_ICONS,
  SUPPORTED_STORES,
  getProductEntries,
  getStorageStats,
  toggleTheme: toggleSharedTheme,
  resolveTheme,
  formatCurrency,
  currencySymbol,
  roundCurrency,
  clamp,
  buildPopupProductKey,
  formatSiteName,
  getHostnameLabel
} = RealDealShared;
const { getSupportDestinations } = RealDealPayPal;

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

const state = {
  activeTab: null,
  activeTabId: null,
  productKey: null,
  currentPrice: null,
  currentCurrency: "USD",
  settings: { ...DEFAULT_SETTINGS },
  targets: {},
  storageSnapshot: {},
  lastResponse: null,
  refreshing: false,
  toastTimer: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  renderSupportedStores();
  renderSupportActions();
  bindEvents();
  syncThemeIcon();
  setView("loading");

  try {
    const [storageSnapshot, activeTab] = await Promise.all([
      chrome.storage.local.get(null),
      getActiveTab()
    ]);

    state.activeTab = activeTab || null;
    state.activeTabId = activeTab?.id || null;
    hydrateStorageState(storageSnapshot);
    syncQuickControls();
    bindStorageWatcher();

    await loadPageData({ force: false });
  } catch (error) {
    console.warn("[RealDeal] Popup failed to initialize:", error);
    disableProductTools("Refresh the page and try again.");
    setView("unavailable");
    showToast("Unable to load RealDeal on this tab");
  }
}

function cacheElements() {
  state.elements = {
    refreshBtn: document.getElementById("refresh-btn"),
    themeToggle: document.getElementById("theme-toggle"),
    settingsBtn: document.getElementById("settings-btn"),
    openSettingsBtn: document.getElementById("btn-open-settings"),
    openPanelBtn: document.getElementById("btn-open-panel"),
    toast: document.getElementById("toast"),
    supportedStores: document.getElementById("supported-stores"),
    loading: document.getElementById("state-loading"),
    unavailable: document.getElementById("state-unavailable"),
    noProduct: document.getElementById("state-no-product"),
    product: document.getElementById("state-product"),
    footerStats: document.getElementById("footer-stats"),
    footerNote: document.getElementById("footer-note"),
    sitePill: document.getElementById("site-pill"),
    historyPill: document.getElementById("history-pill"),
    analysisUpdated: document.getElementById("analysis-updated"),
    shortcutPill: document.getElementById("shortcut-pill"),
    confidencePill: document.getElementById("confidence-pill"),
    snapshotValue: document.getElementById("snapshot-value"),
    targetSummary: document.getElementById("target-summary"),
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
    recentCount: document.getElementById("recent-count"),
    recentList: document.getElementById("recent-list"),
    supportStatus: document.getElementById("support-status"),
    supportNote: document.getElementById("support-note"),
    supportActions: document.getElementById("support-actions"),
    quickToggles: Object.keys(SETTINGS_BINDINGS).reduce((accumulator, id) => {
      accumulator[id] = document.getElementById(id);
      return accumulator;
    }, {})
  };
}

function bindEvents() {
  state.elements.refreshBtn.addEventListener("click", () => loadPageData({ force: true }));
  state.elements.themeToggle.addEventListener("click", toggleTheme);
  state.elements.settingsBtn.addEventListener("click", openSettings);
  state.elements.openSettingsBtn.addEventListener("click", openSettings);
  state.elements.openPanelBtn.addEventListener("click", openFullAnalysis);
  state.elements.saveTargetBtn.addEventListener("click", saveTargetPrice);
  state.elements.clearTargetBtn.addEventListener("click", clearTargetPrice);
  state.elements.recentList.addEventListener("click", openRecentProduct);
  state.elements.supportActions.addEventListener("click", openSupportLink);

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
      await chrome.storage.local.set({
        [STORAGE_KEYS.settings]: state.settings
      });
      showToast("Preference saved");
    });
  });
}

function bindStorageWatcher() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEYS.settings]) {
      state.settings = {
        ...DEFAULT_SETTINGS,
        ...(changes[STORAGE_KEYS.settings].newValue || {})
      };
      syncQuickControls();
    }

    if (changes[STORAGE_KEYS.popupTargets]) {
      state.targets = changes[STORAGE_KEYS.popupTargets].newValue || {};
      if (state.lastResponse?.scraped) {
        enableProductTools(state.lastResponse.scraped);
      }
    }

    const productChange = Object.keys(changes).some((key) => key.startsWith(STORAGE_KEYS.productPrefix));
    if (productChange) {
      state.storageSnapshot = {
        ...state.storageSnapshot,
        ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue]))
      };
      Object.entries(changes).forEach(([key, value]) => {
        if (value.newValue == null) {
          delete state.storageSnapshot[key];
        }
      });
      updateFooterStats();
      renderRecentDeals();
    }
  });
}

function renderSupportedStores() {
  state.elements.supportedStores.innerHTML = SUPPORTED_STORES.map((store) => {
    return `<span class="soft-pill">${store}</span>`;
  }).join("");
}

function toggleTheme() {
  toggleSharedTheme();
  syncThemeIcon();
}

function syncThemeIcon() {
  const theme = resolveTheme();
  state.elements.themeToggle.innerHTML = theme === "dark" ? THEME_ICONS.dark : THEME_ICONS.light;
}

function hydrateStorageState(storageSnapshot) {
  state.storageSnapshot = storageSnapshot;
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...(storageSnapshot[STORAGE_KEYS.settings] || {})
  };
  state.targets = storageSnapshot[STORAGE_KEYS.popupTargets] || {};
  updateFooterStats();
  renderRecentDeals();
  renderSupportActions();
}

function updateFooterStats() {
  const stats = getStorageStats(state.storageSnapshot);
  state.elements.footerStats.textContent = `${stats.trackedProducts} tracked`;
  state.elements.footerNote.textContent = `${stats.observationCount} local price observation${stats.observationCount === 1 ? "" : "s"} stored privately.`;
}

function renderRecentDeals() {
  const recentProducts = getProductEntries(state.storageSnapshot)
    .map(([, product]) => product)
    .filter((product) => Array.isArray(product?.history) && product.history.length)
    .sort((left, right) => {
      const leftTime = left.lastUpdated || left.history[left.history.length - 1]?.timestamp || 0;
      const rightTime = right.lastUpdated || right.history[right.history.length - 1]?.timestamp || 0;
      return rightTime - leftTime;
    })
    .slice(0, 3);

  state.elements.recentCount.textContent = `${recentProducts.length} recent`;

  if (!recentProducts.length) {
    state.elements.recentList.innerHTML = `
      <article class="recent-item">
        <div class="recent-title">No recent products yet</div>
        <div class="recent-note">Browse a few product pages and RealDeal will keep the latest ones here for quick return trips.</div>
      </article>
    `;
    return;
  }

  state.elements.recentList.innerHTML = recentProducts.map((product) => {
    const latest = product.history[product.history.length - 1];
    return `
      <button class="recent-item" type="button" data-url="${escapeHtml(product.productUrl || "")}">
        <div class="recent-topline">
          <span class="recent-title">${escapeHtml(product.name || "Tracked product")}</span>
          <span class="soft-pill">${escapeHtml(formatSiteName(product.site || "store"))}</span>
        </div>
        <div class="recent-meta">
          <span class="recent-note">${formatCurrency(latest?.price, product.currency)} now</span>
          <span class="recent-note">Low ${formatCurrency(product.lowestPrice, product.currency)}</span>
        </div>
      </button>
    `;
  }).join("");
}

function renderSupportActions() {
  const links = getSupportDestinations();
  const readyCount = links.filter((entry) => !entry.disabled).length;

  state.elements.supportStatus.textContent = readyCount ? `${readyCount} ready` : "Unavailable";
  state.elements.supportNote.textContent = readyCount
    ? "Support actions open PayPal.me in a new tab with the configured amount."
    : "Support links are not configured in this build. Add valid PayPal.me links in shared/config.js before release.";

  state.elements.supportActions.innerHTML = links.map((entry) => `
    <button
      class="btn ${entry.disabled ? "btn-secondary" : "btn-primary"}"
      type="button"
      data-support-id="${escapeHtml(entry.id)}"
      data-support-url="${escapeHtml(entry.url || "")}"
      title="${escapeHtml(entry.reason || entry.url || entry.label)}"
      ${entry.disabled ? "disabled" : ""}
    >
      ${escapeHtml(entry.label)}
    </button>
  `).join("");
}

function syncQuickControls() {
  Object.entries(SETTINGS_BINDINGS).forEach(([id, key]) => {
    state.elements.quickToggles[id].checked = Boolean(state.settings[key]);
  });
}

async function loadPageData({ force }) {
  if (!state.activeTab) {
    disableProductTools("Open a supported product page to save a target price.");
    setView("no-product");
    return;
  }

  if (isRestrictedUrl(state.activeTab.url)) {
    disableProductTools("Protected browser pages cannot be analyzed.");
    setView("unavailable");
    return;
  }

  setRefreshState(true);

  try {
    const response = await requestPageData(state.activeTabId, force);

    if (!response?.scraped || !response?.scoreResult) {
      state.lastResponse = null;
      disableProductTools("Open a supported product page to save a target price.");
      setView("no-product");
      return;
    }

    state.lastResponse = response;
    renderProduct(response);
    setView("product");
  } catch (error) {
    console.warn("[RealDeal] Failed to get page data:", error);
    state.lastResponse = null;
    disableProductTools("Refresh the page or reopen the popup to try again.");
    setView("unavailable");
  } finally {
    setRefreshState(false);
  }
}

async function requestPageData(tabId, force) {
  if (!tabId) {
    return null;
  }

  const message = {
    type: force ? "RD_FORCE_ANALYZE" : "RD_GET_PAGE_DATA"
  };

  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    if (force) {
      return chrome.tabs.sendMessage(tabId, { type: "RD_GET_PAGE_DATA" });
    }
    throw new Error("Content script did not respond");
  }
}

function renderProduct({ scraped, stored, scoreResult }) {
  const style = SCORE_STYLES[scoreResult.category] || SCORE_STYLES.green;
  const score = clamp(scoreResult.score || 0, 0, 100);
  const productSite = formatSiteName(scraped.site || getHostnameLabel(scraped.productUrl));
  const historyCount = stored?.history?.length || scoreResult.history?.length || 0;

  state.productKey = stored?.productId || buildPopupProductKey(scraped.productUrl, scraped.name);
  state.currentPrice = scraped.currentPrice ?? null;
  state.currentCurrency = scraped.currency || "USD";

  state.elements.sitePill.textContent = productSite;
  state.elements.historyPill.textContent = historyCount > 0 ? `${historyCount} snapshots` : "Fresh page";
  state.elements.analysisUpdated.textContent = buildUpdatedLabel(stored?.lastUpdated);
  state.elements.shortcutPill.textContent = "Alt+Shift+D";
  state.elements.confidencePill.textContent = buildConfidenceLabel(scraped);
  state.elements.snapshotValue.textContent = `${historyCount || 1} snapshot${historyCount === 1 ? "" : "s"}`;
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

  state.elements.tricksList.innerHTML = tricks.map((trick) => {
    return `
      <article class="insight-item">
        <div class="insight-topline">
          <span class="insight-title">${escapeHtml(trick.label)}</span>
          <span class="soft-pill severity-chip ${escapeHtml(trick.severity)}">${escapeHtml(trick.severity)}</span>
        </div>
        <p class="supporting-text">${escapeHtml(trick.description || trick.label)}</p>
      </article>
    `;
  }).join("");
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
    state.elements.targetSummary.textContent = buildTargetSummary(savedTarget, state.currentPrice, currencyCode);
  } else {
    state.elements.targetInput.value = "";
    state.elements.clearTargetBtn.classList.add("hidden");
    state.elements.targetStatus.textContent = "Save a target and RealDeal will keep your ideal buy price pinned here.";
    state.elements.targetSummary.textContent = "No target saved";
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
  state.elements.targetSummary.textContent = "No target saved";
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
  await chrome.storage.local.set({ [STORAGE_KEYS.popupTargets]: state.targets });
  state.elements.clearTargetBtn.classList.remove("hidden");
  state.elements.targetStatus.textContent = buildTargetStatus(
    state.targets[state.productKey],
    state.currentPrice,
    state.currentCurrency
  );
  state.elements.targetSummary.textContent = buildTargetSummary(
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
  await chrome.storage.local.set({ [STORAGE_KEYS.popupTargets]: state.targets });
  state.elements.targetInput.value = "";
  state.elements.clearTargetBtn.classList.add("hidden");
  state.elements.targetStatus.textContent = "Target removed. Save a new price whenever you want to watch this item again.";
  state.elements.targetSummary.textContent = "No target saved";
  showToast("Target price cleared");
}

async function openSettings() {
  await chrome.runtime.openOptionsPage();
}

async function openRecentProduct(event) {
  const button = event.target.closest("[data-url]");
  if (!button) {
    return;
  }

  const url = button.dataset.url;
  if (!url) {
    return;
  }

  if (state.activeTabId) {
    await chrome.tabs.update(state.activeTabId, { url });
  } else {
    await chrome.tabs.create({ url });
  }

  window.close();
}

async function openSupportLink(event) {
  const button = event.target.closest("[data-support-id]");
  if (!button || button.disabled) {
    return;
  }

  const url = button.dataset.supportUrl;
  if (!url) {
    showToast("This support link is not configured");
    return;
  }

  await chrome.tabs.create({ url });
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
  state.elements.unavailable.classList.toggle("hidden", view !== "unavailable");
  state.elements.noProduct.classList.toggle("hidden", view !== "no-product");
  state.elements.product.classList.toggle("hidden", view !== "product");
}

function setRefreshState(isRefreshing) {
  state.refreshing = isRefreshing;
  state.elements.refreshBtn.disabled = isRefreshing;
  state.elements.refreshBtn.style.transform = isRefreshing ? "rotate(120deg)" : "";
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

function buildUpdatedLabel(lastUpdated) {
  if (!lastUpdated) {
    return "Fresh scan";
  }

  const minutes = Math.round((Date.now() - lastUpdated) / 60000);
  if (minutes <= 1) {
    return "Updated just now";
  }
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}

function buildConfidenceLabel(scraped) {
  if (!scraped?.scraperConfidence || scraped.scraperConfidence === "high") {
    return "Dedicated parser";
  }

  return `${scraped.scraperSource || "Fallback"} (${scraped.scraperConfidence})`;
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

function buildTargetSummary(targetPrice, currentPrice, currency) {
  if (currentPrice == null) {
    return `Target ${formatCurrency(targetPrice, currency)}`;
  }

  const delta = roundCurrency(currentPrice - targetPrice);
  if (delta <= 0) {
    return "Target reached";
  }

  return `${formatCurrency(delta, currency)} above target`;
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

function isRestrictedUrl(url) {
  return typeof url === "string" && /^(chrome|edge|about|moz-extension|chrome-extension):/i.test(url);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
