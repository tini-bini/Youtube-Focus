(function () {
  "use strict";

  importScripts("shared.js");

  const {
    STORAGE_KEYS,
    normalizeStoredState,
    storageGet,
    storageSet,
    sanitizeAccount,
    sanitizeAnalyticsState,
    sanitizePopupState,
    sanitizeSessionState,
    getProfileSettings,
    createSnoozedSession,
    clearSnooze,
    isSessionSnoozed,
    bumpAnalytics
  } = YTFCShared;

  chrome.runtime.onInstalled.addListener(() => {
    void normalizeState();
  });

  chrome.runtime.onStartup.addListener(() => {
    void normalizeState();
  });

  chrome.commands.onCommand.addListener((command) => {
    void handleCommand(command);
  });

  async function normalizeState() {
    const rawState = await storageGet(Object.values(STORAGE_KEYS));
    const normalized = normalizeStoredState(rawState);

    if (Object.keys(normalized.nextState).length > 0) {
      await storageSet(normalized.nextState);
    }
  }

  async function handleCommand(command) {
    await normalizeState();

    if (command === "toggle-snooze") {
      await toggleSnooze();
      return;
    }

    if (command === "enable-deep-work") {
      await enableDeepWork();
    }
  }

  async function toggleSnooze() {
    const rawState = await storageGet([STORAGE_KEYS.session, STORAGE_KEYS.analytics]);
    const session = sanitizeSessionState(rawState[STORAGE_KEYS.session]);
    const analytics = sanitizeAnalyticsState(rawState[STORAGE_KEYS.analytics]);
    const nextSession = isSessionSnoozed(session) ? clearSnooze() : createSnoozedSession(15);
    const nextAnalytics = isSessionSnoozed(session)
      ? analytics
      : bumpAnalytics(analytics, { snoozeCount: 1 });

    await storageSet({
      [STORAGE_KEYS.session]: nextSession,
      [STORAGE_KEYS.analytics]: nextAnalytics
    });
  }

  async function enableDeepWork() {
    const rawState = await storageGet([
      STORAGE_KEYS.settings,
      STORAGE_KEYS.account,
      STORAGE_KEYS.popupState,
      STORAGE_KEYS.session,
      STORAGE_KEYS.analytics
    ]);

    const account = sanitizeAccount(rawState[STORAGE_KEYS.account]);
    const popupState = sanitizePopupState(rawState[STORAGE_KEYS.popupState]);
    const analytics = sanitizeAnalyticsState(rawState[STORAGE_KEYS.analytics]);
    const nextSettings = {
      ...getProfileSettings("deepWork")
    };

    await storageSet({
      [STORAGE_KEYS.settings]: nextSettings,
      [STORAGE_KEYS.popupState]: {
        ...popupState,
        activeProfile: "deepWork"
      },
      [STORAGE_KEYS.session]: clearSnooze(),
      [STORAGE_KEYS.analytics]: bumpAnalytics(analytics, { profileApplies: 1 }),
      [STORAGE_KEYS.account]: account
    });
  }
})();
