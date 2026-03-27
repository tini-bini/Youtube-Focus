// RealDeal — Background Service Worker
// Handles badge updates, storage pruning, and message routing.

const PRUNE_ALARM = 'rd_prune_history';

// ── Install / Startup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({
      rd_settings: {
        historyDays: 90,
        enableFakeWasDetection: true,
        enablePriceAnchorDetection: true,
        enableUrgencyDetection: true,
        enableRollbackDetection: true,
        enableSubscriptionDetection: true,
        showInlineLabel: true,
        showBadge: true
      }
    });
    console.log('[RealDeal] Installed — welcome!');
  }

  // Daily prune alarm
  chrome.alarms.create(PRUNE_ALARM, {
    periodInMinutes: 24 * 60
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(PRUNE_ALARM, {
    periodInMinutes: 24 * 60
  });
});

// ── Alarms ───────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PRUNE_ALARM) {
    await pruneAllHistory();
  }
});

async function pruneAllHistory() {
  const data = await chrome.storage.local.get(null);
  const settings = data.rd_settings || { historyDays: 90 };
  const cutoff = Date.now() - settings.historyDays * 24 * 60 * 60 * 1000;

  const updates = {};
  const removals = [];
  let pruned = 0;

  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('rd_p_')) continue;
    if (!value.history || !Array.isArray(value.history)) continue;

    const before = value.history.length;
    value.history = value.history.filter(h => h.timestamp >= cutoff);

    if (value.history.length !== before) {
      pruned += before - value.history.length;
      if (value.history.length > 0) {
        // Recalculate stats after trimming retained history.
        const prices = value.history.map(h => h.price).filter(p => p != null);
        value.lowestPrice = Math.min(...prices);
        value.highestPrice = Math.max(...prices);
        value.lastUpdated = value.history[value.history.length - 1]?.timestamp || null;
        updates[key] = value;
      } else {
        removals.push(key);
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
  if (removals.length > 0) {
    await chrome.storage.local.remove(removals);
  }
  if (pruned > 0 || removals.length > 0) {
    console.log(`[RealDeal] Pruned ${pruned} old history entries and removed ${removals.length} empty product records.`);
  }
}

// ── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RD_UPDATE_BADGE') {
    updateBadge(sender.tab?.id, message.score, message.category);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'RD_GET_SETTINGS') {
    chrome.storage.local.get('rd_settings').then(data => {
      sendResponse({ settings: data.rd_settings || {} });
    });
    return true; // async
  }

  if (message.type === 'RD_CLEAR_BADGE') {
    clearBadge(sender.tab?.id);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'RD_OPEN_SETTINGS') {
    chrome.runtime.openOptionsPage().then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      console.warn('[RealDeal] Failed to open settings page:', error);
      sendResponse({ ok: false });
    });
    return true;
  }

  if (message.type === 'RD_PING') {
    sendResponse({ alive: true });
    return false;
  }

  return false;
});

// ── Badge Helpers ─────────────────────────────────────────────────────────────

function updateBadge(tabId, score, category) {
  if (!tabId) return;

  const colors = {
    green:  [34, 197, 94, 255],   // #22c55e
    yellow: [234, 179, 8, 255],   // #eab308
    red:    [239, 68, 68, 255]    // #ef4444
  };

  const color = colors[category] || colors.yellow;
  const text  = score != null ? String(score) : '?';

  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setTitle({ tabId, title: `RealDeal — Trust Score: ${text}/100` });
}

function clearBadge(tabId) {
  if (!tabId) return;

  chrome.action.setBadgeText({ tabId, text: '' });
  chrome.action.setTitle({ tabId, title: 'RealDeal — Fake Sale Detector' });
}
