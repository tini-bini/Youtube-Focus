importScripts("shared/config.js");

const { DEFAULT_SETTINGS, STORAGE_KEYS, isProductStorageKey, formatCurrency } = RealDealShared;
const PRUNE_ALARM = "rd_prune_history";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    const existing = await chrome.storage.local.get(STORAGE_KEYS.settings);
    await chrome.storage.local.set({
      [STORAGE_KEYS.settings]: {
        ...DEFAULT_SETTINGS,
        ...(existing[STORAGE_KEYS.settings] || {})
      }
    });
  }

  ensurePruneAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensurePruneAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PRUNE_ALARM) {
    await pruneAllHistory();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RD_UPDATE_BADGE") {
    updateBadge(sender.tab?.id, message.score, message.category);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "RD_CLEAR_BADGE") {
    clearBadge(sender.tab?.id);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "RD_GET_SETTINGS") {
    chrome.storage.local.get(STORAGE_KEYS.settings).then((data) => {
      sendResponse({
        settings: {
          ...DEFAULT_SETTINGS,
          ...(data[STORAGE_KEYS.settings] || {})
        }
      });
    });
    return true;
  }

  if (message.type === "RD_OPEN_SETTINGS") {
    chrome.runtime.openOptionsPage()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.warn("[RealDeal] Failed to open settings page:", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message.type === "RD_PING") {
    sendResponse({ alive: true });
    return false;
  }

  if (message.type === "RD_MAYBE_NOTIFY_TARGET") {
    maybeNotifyTarget(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.warn("[RealDeal] Failed to process target notification:", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  return false;
});

function ensurePruneAlarm() {
  chrome.alarms.create(PRUNE_ALARM, {
    periodInMinutes: 24 * 60
  });
}

async function pruneAllHistory() {
  const snapshot = await chrome.storage.local.get(null);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(snapshot[STORAGE_KEYS.settings] || {})
  };
  const cutoff = Date.now() - settings.historyDays * 24 * 60 * 60 * 1000;

  const updates = {};
  const removals = [];
  let prunedEntries = 0;

  Object.entries(snapshot).forEach(([key, value]) => {
    if (!isProductStorageKey(key) || !Array.isArray(value?.history)) {
      return;
    }

    const nextHistory = value.history.filter((entry) => entry.timestamp >= cutoff);

    if (nextHistory.length === value.history.length) {
      return;
    }

    prunedEntries += value.history.length - nextHistory.length;

    if (!nextHistory.length) {
      removals.push(key);
      return;
    }

    const prices = nextHistory
      .map((entry) => entry.price)
      .filter((price) => price != null);

    updates[key] = {
      ...value,
      history: nextHistory,
      lowestPrice: prices.length ? Math.min(...prices) : null,
      highestPrice: prices.length ? Math.max(...prices) : null,
      lastUpdated: nextHistory[nextHistory.length - 1]?.timestamp || value.lastUpdated || null
    };
  });

  if (Object.keys(updates).length) {
    await chrome.storage.local.set(updates);
  }

  if (removals.length) {
    await chrome.storage.local.remove(removals);
  }

  if (prunedEntries || removals.length) {
    console.info(
      `[RealDeal] Pruned ${prunedEntries} history entries and removed ${removals.length} empty product records.`
    );
  }
}

function updateBadge(tabId, score, category) {
  if (!tabId) {
    return;
  }

  const colors = {
    green: [34, 197, 94, 255],
    yellow: [234, 179, 8, 255],
    red: [239, 68, 68, 255]
  };

  chrome.action.setBadgeText({
    tabId,
    text: score != null ? String(score) : "?"
  });
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: colors[category] || colors.yellow
  });
  chrome.action.setTitle({
    tabId,
    title: `RealDeal - Trust Score: ${score != null ? score : "?"}/100`
  });
}

function clearBadge(tabId) {
  if (!tabId) {
    return;
  }

  chrome.action.setBadgeText({ tabId, text: "" });
  chrome.action.setTitle({ tabId, title: "RealDeal - Fake Sale Detector" });
}

async function maybeNotifyTarget(payload) {
  const { productId, productUrl, name, currentPrice, currency } = payload || {};
  if (!productId || currentPrice == null) {
    return { ok: false };
  }

  const snapshot = await chrome.storage.local.get([
    STORAGE_KEYS.popupTargets,
    STORAGE_KEYS.targetNotifications
  ]);
  const targets = snapshot[STORAGE_KEYS.popupTargets] || {};
  const notifications = snapshot[STORAGE_KEYS.targetNotifications] || {};
  const target = targets[productId];

  if (typeof target !== "number") {
    if (notifications[productId]) {
      delete notifications[productId];
      await chrome.storage.local.set({ [STORAGE_KEYS.targetNotifications]: notifications });
    }
    return { ok: true, notified: false };
  }

  if (currentPrice > target) {
    if (notifications[productId]) {
      delete notifications[productId];
      await chrome.storage.local.set({ [STORAGE_KEYS.targetNotifications]: notifications });
    }
    return { ok: true, notified: false };
  }

  const lastNotice = notifications[productId];
  const twelveHours = 12 * 60 * 60 * 1000;
  if (
    lastNotice &&
    lastNotice.price === currentPrice &&
    lastNotice.target === target &&
    Date.now() - lastNotice.timestamp < twelveHours
  ) {
    return { ok: true, notified: false };
  }

  await chrome.notifications.create(`realdeal-target-${productId}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Price target hit",
    message: `${name || "Tracked product"} is now ${formatCurrency(currentPrice, currency)} or better. Your target was ${formatCurrency(target, currency)}.`,
    priority: 2
  });

  notifications[productId] = {
    price: currentPrice,
    target,
    timestamp: Date.now(),
    productUrl: productUrl || null
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.targetNotifications]: notifications });
  return { ok: true, notified: true };
}
