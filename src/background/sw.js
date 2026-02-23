import {
  DEFAULT_SETTINGS,
  DEFAULT_DAILY_STATE,
  getSettings,
  setSettings,
  getDailyState,
  setDailyState,
  normalizeSettings,
  normalizeDailyState,
  getEffectiveDateKST,
  upsertHistory,
  computeStats,
  pushRecentLog
} from "../shared/storage.js";
import { buildProblemQuery, pickDeterministicProblemId, getTodayProblemUrl, isTodayProblemUrl } from "../shared/picker.js";
import { searchProblem, extractProblemCandidates, checkSolved, checkHandle, classifyError } from "../shared/solvedac-api.js";

const NORMAL_REDIRECT_COOLDOWN_MS = 1200;
const DEBUG_REDIRECT_COOLDOWN_MS = 350;
const MAX_AUTO_RECHECK = 6;
const AUTO_RECHECK_DELAYS_MS = [10000, 30000, 60000, 300000, 600000, 1800000];
const DEBUG_AUTO_RECHECK_DELAYS_MS = [2000, 4000, 8000, 12000, 20000, 30000];

let ensureDailyLock = null;
let recheckInFlight = false;
let autoRetryTimer = null;
let autoRetryAttempt = 0;
const redirectGuard = new Map();

function now() {
  return Date.now();
}

async function log(level, msg, data = null) {
  const settings = await getSettings();
  if (settings.debugMode || level === "warn" || level === "error") {
    // eslint-disable-next-line no-console
    console[level === "error" ? "error" : "log"](`[SW] ${msg}`, data ?? "");
  }
  if (!settings.debugMode && level === "info") return;
  const daily = await getDailyState();
  daily.recentLogs = pushRecentLog(daily.recentLogs, { ts: now(), level, msg, data });
  await setDailyState(daily);
}

function isEmergencyActive(dailyState) {
  return Number(dailyState.emergencyUntil || 0) > now();
}

function isSkippableUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    url.startsWith("edge://")
  );
}

function isWhitelisted(url, whitelist) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return whitelist.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function getStatus(dailyState) {
  if (isEmergencyActive(dailyState)) return "EMERGENCY";
  if (dailyState.solved) return "DONE";
  return "PENDING";
}

async function setBadge(dailyState) {
  const status = getStatus(dailyState);
  if (status === "DONE") {
    await chrome.action.setBadgeText({ text: "✓" });
    await chrome.action.setBadgeBackgroundColor({ color: "#52c41a" });
  } else if (status === "EMERGENCY") {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#faad14" });
  } else {
    await chrome.action.setBadgeText({ text: "•" });
    await chrome.action.setBadgeBackgroundColor({ color: "#f5222d" });
  }
}

function recomputeStreak(dailyState, todayDateKST) {
  const stats = computeStats(dailyState, todayDateKST);
  dailyState.streak = stats.streak;
  if (dailyState.solved) dailyState.lastDoneDateKST = todayDateKST;
}

async function pickProblem(settings, dateKST, rerollUsed) {
  const query = buildProblemQuery(settings);
  const response = await searchProblem(query, 1);
  const candidates = extractProblemCandidates(response);
  const ids = candidates.map((item) => item.problemId);
  if (!ids.length) {
    const err = new Error("No candidate problems from current filters.");
    err.code = "no_candidates";
    throw err;
  }

  const problemId = pickDeterministicProblemId(ids, dateKST, rerollUsed);
  const chosen = candidates.find((item) => item.problemId === problemId);
  return {
    problemId,
    level: Number(chosen?.level || 0),
    titleKo: chosen?.titleKo || "",
    titleEn: chosen?.titleEn || "",
    query
  };
}

function createFreshDaily(dateKST, prev) {
  let history = Array.isArray(prev?.history) ? prev.history : [];
  if (prev?.dateKST && prev?.todayProblemId > 0) {
    history = upsertHistory(history, {
      dateKST: prev.dateKST,
      problemId: prev.todayProblemId,
      done: Boolean(prev.solved)
    });
  }
  return normalizeDailyState({
    ...DEFAULT_DAILY_STATE,
    dateKST,
    emergencyUsedDateKST: prev?.emergencyUsedDateKST || "",
    emergencyUntil: prev?.emergencyUntil || 0,
    streak: prev?.streak || 0,
    lastDoneDateKST: prev?.lastDoneDateKST || "",
    history,
    recentLogs: prev?.recentLogs || []
  });
}

async function ensureDailyState({ forceRepick = false } = {}) {
  if (ensureDailyLock && !forceRepick) return ensureDailyLock;

  ensureDailyLock = (async () => {
    const settings = await getSettings();
    const todayDateKST = getEffectiveDateKST(settings);
    let daily = await getDailyState();
    let changed = false;

    if (daily.dateKST !== todayDateKST) {
      daily = createFreshDaily(todayDateKST, daily);
      changed = true;
      autoRetryAttempt = 0;
    }

    if (!settings.handle) {
      daily.todayProblemId = 0;
      daily.todayProblemLevel = 0;
      daily.todayProblemTitleKo = "";
      daily.todayProblemTitleEn = "";
      daily.pickedFromQuery = "";
      daily.lastApiError = "missing_handle";
      changed = true;
    } else if (forceRepick || !daily.todayProblemId) {
      try {
        const picked = await pickProblem(settings, todayDateKST, daily.rerollUsed);
        daily.todayProblemId = picked.problemId;
        daily.todayProblemLevel = picked.level;
        daily.todayProblemTitleKo = picked.titleKo;
        daily.todayProblemTitleEn = picked.titleEn;
        daily.pickedFromQuery = picked.query;
        daily.lastApiError = "";
        changed = true;
      } catch (err) {
        daily.todayProblemId = 0;
        daily.todayProblemLevel = 0;
        daily.todayProblemTitleKo = "";
        daily.todayProblemTitleEn = "";
        daily.pickedFromQuery = buildProblemQuery(settings);
        daily.lastApiError = classifyError(err) === "no_candidates" ? "no_candidates" : classifyError(err);
        changed = true;
        await log("warn", "Problem pick failed", { code: classifyError(err) });
      }
    }

    recomputeStreak(daily, todayDateKST);
    if (changed) daily = await setDailyState(daily);
    await setBadge(daily);
    if (settings.autoRecheck) maybeScheduleAutoRecheck(settings, daily);

    return { settings, daily, todayDateKST };
  })();

  try {
    return await ensureDailyLock;
  } finally {
    ensureDailyLock = null;
  }
}

function clearAutoTimer() {
  if (!autoRetryTimer) return;
  clearTimeout(autoRetryTimer);
  autoRetryTimer = null;
}

function maybeScheduleAutoRecheck(settings, daily) {
  clearAutoTimer();
  if (!settings.autoRecheck) return;
  if (!settings.handle || !daily.todayProblemId) return;
  if (daily.solved || isEmergencyActive(daily)) return;
  if (autoRetryAttempt >= MAX_AUTO_RECHECK) return;

  const delays = settings.debugMode ? DEBUG_AUTO_RECHECK_DELAYS_MS : AUTO_RECHECK_DELAYS_MS;
  const delay = delays[Math.min(autoRetryAttempt, delays.length - 1)];
  autoRetryTimer = setTimeout(() => {
    performSolvedCheck("auto").catch(() => {});
  }, delay);
}

async function performSolvedCheck(trigger = "manual") {
  if (recheckInFlight) return { ok: false, reason: "in_flight" };
  recheckInFlight = true;
  try {
    const { settings, daily, todayDateKST } = await ensureDailyState();
    if (!settings.handle || !daily.todayProblemId) return { ok: false, reason: "not_ready" };

    const solved = await checkSolved(settings.handle, daily.todayProblemId);
    daily.lastSolvedCheckAt = now();
    if (solved) {
      daily.solved = true;
      daily.lastApiError = "";
      recomputeStreak(daily, todayDateKST);
      await setDailyState(daily);
      await setBadge(daily);
      autoRetryAttempt = 0;
      clearAutoTimer();
      await log("info", "Solved check success -> DONE", { trigger });
      return { ok: true, solved: true };
    }

    daily.lastApiError = "";
    await setDailyState(daily);
    await setBadge(daily);
    if (trigger === "auto") autoRetryAttempt += 1;
    maybeScheduleAutoRecheck(settings, daily);
    return { ok: true, solved: false };
  } catch (err) {
    const code = classifyError(err);
    const daily = await getDailyState();
    daily.lastSolvedCheckAt = now();
    daily.lastApiError = code;
    await setDailyState(daily);
    await setBadge(daily);
    autoRetryAttempt += 1;
    const settings = await getSettings();
    maybeScheduleAutoRecheck(settings, daily);
    await log("warn", "Solved check failed", { code, trigger });
    return { ok: false, reason: code };
  } finally {
    recheckInFlight = false;
  }
}

async function rerollToday() {
  const { settings, daily, todayDateKST } = await ensureDailyState();
  if (!settings.handle) throw new Error("missing_handle");
  if (daily.rerollUsed >= settings.rerollLimitPerDay) throw new Error("reroll_limit");
  daily.rerollUsed += 1;
  daily.solved = false;

  const picked = await pickProblem(settings, todayDateKST, daily.rerollUsed);
  daily.todayProblemId = picked.problemId;
  daily.todayProblemLevel = picked.level;
  daily.todayProblemTitleKo = picked.titleKo;
  daily.todayProblemTitleEn = picked.titleEn;
  daily.pickedFromQuery = picked.query;
  daily.lastApiError = "";
  autoRetryAttempt = 0;
  await setDailyState(daily);
  await setBadge(daily);
  maybeScheduleAutoRecheck(settings, daily);
  return daily;
}

async function activateEmergency() {
  const { settings, daily, todayDateKST } = await ensureDailyState();
  if (daily.emergencyUsedDateKST === todayDateKST) throw new Error("emergency_used_today");
  daily.emergencyUsedDateKST = todayDateKST;
  daily.emergencyUntil = now() + settings.emergencyHours * 60 * 60 * 1000;
  await setDailyState(daily);
  await setBadge(daily);
  clearAutoTimer();
  return daily;
}

async function deactivateEmergency() {
  const { settings, daily } = await ensureDailyState();
  if (!isEmergencyActive(daily)) return daily;
  daily.emergencyUntil = 0;
  await setDailyState(daily);
  await setBadge(daily);
  maybeScheduleAutoRecheck(settings, daily);
  return daily;
}

function redirectCooldownMs(settings) {
  return settings.debugMode ? DEBUG_REDIRECT_COOLDOWN_MS : NORMAL_REDIRECT_COOLDOWN_MS;
}

async function enforceTab(tabId, url) {
  const { settings, daily } = await ensureDailyState();
  if (!url || isSkippableUrl(url)) return;
  if (isEmergencyActive(daily)) return;
  if (daily.solved) return;
  if (!settings.handle || !daily.todayProblemId) return;
  if (isTodayProblemUrl(url, daily.todayProblemId)) return;
  if (isWhitelisted(url, settings.whitelist)) return;

  const guard = redirectGuard.get(tabId);
  const cooldown = redirectCooldownMs(settings);
  const currentAt = now();
  if (guard && guard.url === url && currentAt - guard.at < cooldown) return;
  redirectGuard.set(tabId, { url, at: currentAt });
  await chrome.tabs.update(tabId, { url: getTodayProblemUrl(daily.todayProblemId) });
}

async function maybeOpenProblemOnStartup() {
  const { daily } = await ensureDailyState();
  if (!daily.todayProblemId) return;
  if (daily.solved || isEmergencyActive(daily)) return;
  const target = getTodayProblemUrl(daily.todayProblemId);
  const tabs = await chrome.tabs.query({});
  if (tabs.some((t) => t.url && t.url.startsWith(target))) return;
  await chrome.tabs.create({ url: target, active: true });
}

async function maybeOpenProblemOnNewTab(tab) {
  if (tab?.id === undefined) return;
  const { daily } = await ensureDailyState();
  if (!daily.todayProblemId) return;
  if (daily.solved || isEmergencyActive(daily)) return;
  const pending = tab.pendingUrl || tab.url || "";
  const looksLikeBlank = pending === "" || pending.startsWith("chrome://newtab");
  if (!looksLikeBlank) return;
  await chrome.tabs.update(tab.id, { url: getTodayProblemUrl(daily.todayProblemId) });
}

async function buildSnapshot() {
  const { settings, daily, todayDateKST } = await ensureDailyState();
  const emergencyActive = isEmergencyActive(daily);
  const stats = computeStats(daily, todayDateKST);
  return {
    settings,
    daily,
    todayDateKST,
    status: getStatus(daily),
    problemUrl: daily.todayProblemId ? getTodayProblemUrl(daily.todayProblemId) : "",
    problemLevel: daily.todayProblemLevel,
    problemTitle:
      settings.uiLanguage === "ko"
        ? daily.todayProblemTitleKo || daily.todayProblemTitleEn || ""
        : daily.todayProblemTitleEn || daily.todayProblemTitleKo || "",
    rerollRemaining: Math.max(0, settings.rerollLimitPerDay - daily.rerollUsed),
    emergencyActive,
    emergencyCanActivate: daily.emergencyUsedDateKST !== todayDateKST,
    emergencyRemainingMs: Math.max(0, daily.emergencyUntil - now()),
    stats
  };
}

async function resetToday() {
  const { settings, daily, todayDateKST } = await ensureDailyState();
  daily.dateKST = todayDateKST;
  daily.solved = false;
  daily.rerollUsed = 0;
  daily.lastSolvedCheckAt = 0;
  daily.lastApiError = "";
  if (daily.emergencyUntil <= now()) daily.emergencyUntil = 0;

  if (settings.handle) {
    const picked = await pickProblem(settings, todayDateKST, 0);
    daily.todayProblemId = picked.problemId;
    daily.todayProblemLevel = picked.level;
    daily.todayProblemTitleKo = picked.titleKo;
    daily.todayProblemTitleEn = picked.titleEn;
    daily.pickedFromQuery = picked.query;
  } else {
    daily.todayProblemId = 0;
    daily.todayProblemLevel = 0;
    daily.todayProblemTitleKo = "";
    daily.todayProblemTitleEn = "";
    daily.pickedFromQuery = "";
  }

  recomputeStreak(daily, todayDateKST);
  await setDailyState(daily);
  await setBadge(daily);
  return daily;
}

async function factoryReset() {
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
  await setSettings(DEFAULT_SETTINGS);
  await setDailyState(DEFAULT_DAILY_STATE);
  autoRetryAttempt = 0;
  clearAutoTimer();
  await ensureDailyState({ forceRepick: true });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDailyState({ forceRepick: true })
    .then(() => maybeOpenProblemOnStartup())
    .catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureDailyState()
    .then(() => maybeOpenProblemOnStartup())
    .catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab?.url;
  if (!url) return;
  enforceTab(tabId, url).catch(() => {});
});

chrome.tabs.onCreated.addListener((tab) => {
  maybeOpenProblemOnNewTab(tab).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    const type = message?.type;
    if (type === "GET_SNAPSHOT") return { ok: true, snapshot: await buildSnapshot() };
    if (type === "SET_MODE") return { ok: false, error: "mode_locked" };
    if (type === "SAVE_SETTINGS") {
      const next = normalizeSettings(message.settings);
      await setSettings(next);
      await ensureDailyState({ forceRepick: true });
      return { ok: true, snapshot: await buildSnapshot() };
    }
    if (type === "RECHECK") {
      const result = await performSolvedCheck("manual");
      return { ok: true, result, snapshot: await buildSnapshot() };
    }
    if (type === "REROLL") {
      await rerollToday();
      return { ok: true, snapshot: await buildSnapshot() };
    }
    if (type === "TOGGLE_EMERGENCY") {
      const { daily } = await ensureDailyState();
      if (isEmergencyActive(daily)) await deactivateEmergency();
      else await activateEmergency();
      return { ok: true, snapshot: await buildSnapshot() };
    }
    if (type === "OPEN_TODAY") {
      const { daily } = await ensureDailyState();
      if (daily.todayProblemId) {
        await chrome.tabs.create({ url: getTodayProblemUrl(daily.todayProblemId), active: true });
      }
      return { ok: true };
    }
    if (type === "RESET_TODAY") {
      await resetToday();
      return { ok: true, snapshot: await buildSnapshot() };
    }
    if (type === "FACTORY_RESET") {
      await factoryReset();
      return { ok: true, snapshot: await buildSnapshot() };
    }
    if (type === "VALIDATE_HANDLE") {
      const handle = String(message.handle || "").trim();
      if (!handle) return { ok: false, error: "missing_handle" };
      try {
        const user = await checkHandle(handle);
        return { ok: true, user };
      } catch (err) {
        return { ok: false, error: classifyError(err) };
      }
    }
    if (type === "GET_LOGS") {
      const daily = await getDailyState();
      return { ok: true, logs: daily.recentLogs || [] };
    }
    return { ok: false, error: "unknown_message" };
  };

  run()
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});
