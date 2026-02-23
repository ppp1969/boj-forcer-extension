export const MODE = Object.freeze({
  OFF: "off",
  SOFT: "soft",
  HARD: "hard",
  WHITELIST_ONLY: "whitelist_only"
});

export const DEFAULT_WHITELIST = [
  "google.com",
  "github.com",
  "stackoverflow.com",
  "notion.so",
  "chatgpt.com",
  "acmicpc.net",
  "solved.ac"
];

export const DEFAULT_SETTINGS = Object.freeze({
  handle: "",
  uiLanguage: "en",
  theme: "vivid",
  mode: MODE.WHITELIST_ONLY,
  whitelist: [...DEFAULT_WHITELIST],
  filters: {
    levelMin: 6,
    levelMax: 15,
    languages: ["ko", "en"],
    requireSolvable: true,
    excludeWarnings: true,
    minSolvedCount: 1,
    includeTags: [],
    excludeTags: []
  },
  rerollLimitPerDay: 3,
  emergencyHours: 3,
  autoReEnableDaily: true,
  openOnStartup: true,
  openOnNewTab: false,
  autoRecheck: true,
  debugMode: false,
  debugDateKST: null
});

export const DEFAULT_DAILY_STATE = Object.freeze({
  dateKST: "",
  todayProblemId: 0,
  todayProblemLevel: 0,
  todayProblemTitleKo: "",
  todayProblemTitleEn: "",
  pickedFromQuery: "",
  solved: false,
  lastSolvedCheckAt: 0,
  rerollUsed: 0,
  emergencyUsedDateKST: "",
  emergencyUntil: 0,
  streak: 0,
  lastDoneDateKST: "",
  lastApiError: "",
  history: [],
  recentLogs: []
});

const KST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HISTORY = 60;
const MAX_LOGS = 200;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function cleanTagList(tags) {
  const out = [];
  const seen = new Set();
  for (const raw of asArray(tags)) {
    const tag = String(raw || "").trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function cleanWhitelist(whitelist) {
  const out = [];
  const seen = new Set();
  for (const raw of asArray(whitelist)) {
    const d = String(raw || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out.length ? out : [...DEFAULT_WHITELIST];
}

function normalizeFilters(filters) {
  const merged = { ...DEFAULT_SETTINGS.filters, ...(filters || {}) };
  let levelMin = clampNumber(merged.levelMin, 1, 30, DEFAULT_SETTINGS.filters.levelMin);
  let levelMax = clampNumber(merged.levelMax, 1, 30, DEFAULT_SETTINGS.filters.levelMax);
  if (levelMin > levelMax) [levelMin, levelMax] = [levelMax, levelMin];

  const langs = cleanTagList(merged.languages).filter((v) => v === "ko" || v === "en");
  return {
    levelMin,
    levelMax,
    languages: langs.length ? langs : [...DEFAULT_SETTINGS.filters.languages],
    requireSolvable: Boolean(merged.requireSolvable),
    excludeWarnings: Boolean(merged.excludeWarnings),
    minSolvedCount: clampNumber(merged.minSolvedCount, 1, 1_000_000, DEFAULT_SETTINGS.filters.minSolvedCount),
    includeTags: cleanTagList(merged.includeTags),
    excludeTags: cleanTagList(merged.excludeTags)
  };
}

export function normalizeSettings(input) {
  const merged = { ...DEFAULT_SETTINGS, ...(input || {}) };
  const uiLanguage = String(merged.uiLanguage || "").toLowerCase();
  const theme = String(merged.theme || "").toLowerCase();
  return {
    handle: String(merged.handle || "").trim(),
    uiLanguage: uiLanguage === "ko" ? "ko" : "en",
    theme: theme === "dark" || theme === "light" ? theme : "vivid",
    // Mode UI is removed; enforcement is always whitelist-only policy.
    mode: MODE.WHITELIST_ONLY,
    whitelist: cleanWhitelist(merged.whitelist),
    filters: normalizeFilters(merged.filters),
    rerollLimitPerDay: clampNumber(merged.rerollLimitPerDay, 0, 20, DEFAULT_SETTINGS.rerollLimitPerDay),
    emergencyHours: clampNumber(merged.emergencyHours, 1, 24, DEFAULT_SETTINGS.emergencyHours),
    autoReEnableDaily: Boolean(merged.autoReEnableDaily),
    openOnStartup: Boolean(merged.openOnStartup),
    openOnNewTab: Boolean(merged.openOnNewTab),
    autoRecheck: merged.autoRecheck !== false,
    debugMode: Boolean(merged.debugMode),
    debugDateKST: KST_DATE_RE.test(String(merged.debugDateKST || "")) ? String(merged.debugDateKST) : null
  };
}

function normalizeHistory(history) {
  const out = [];
  for (const row of asArray(history)) {
    const dateKST = String(row?.dateKST || "");
    const problemId = Number(row?.problemId || 0);
    if (!KST_DATE_RE.test(dateKST)) continue;
    if (!Number.isInteger(problemId) || problemId <= 0) continue;
    out.push({ dateKST, problemId, done: Boolean(row?.done) });
  }
  out.sort((a, b) => a.dateKST.localeCompare(b.dateKST));
  return out.slice(-MAX_HISTORY);
}

function normalizeLogs(logs) {
  const out = [];
  for (const row of asArray(logs)) {
    const ts = Number(row?.ts);
    const level = String(row?.level || "info");
    const msg = String(row?.msg || "");
    if (!Number.isFinite(ts) || !msg) continue;
    out.push({
      ts,
      level,
      msg,
      data: row?.data ?? null
    });
  }
  return out.slice(-MAX_LOGS);
}

export function normalizeDailyState(input) {
  const merged = { ...DEFAULT_DAILY_STATE, ...(input || {}) };
  return {
    dateKST: KST_DATE_RE.test(String(merged.dateKST || "")) ? String(merged.dateKST) : "",
    todayProblemId: clampNumber(merged.todayProblemId, 0, 1_000_000, 0),
    todayProblemLevel: clampNumber(merged.todayProblemLevel, 0, 30, 0),
    todayProblemTitleKo: String(merged.todayProblemTitleKo || ""),
    todayProblemTitleEn: String(merged.todayProblemTitleEn || ""),
    pickedFromQuery: String(merged.pickedFromQuery || ""),
    solved: Boolean(merged.solved),
    lastSolvedCheckAt: clampNumber(merged.lastSolvedCheckAt, 0, Number.MAX_SAFE_INTEGER, 0),
    rerollUsed: clampNumber(merged.rerollUsed, 0, 100, 0),
    emergencyUsedDateKST: KST_DATE_RE.test(String(merged.emergencyUsedDateKST || ""))
      ? String(merged.emergencyUsedDateKST)
      : "",
    emergencyUntil: clampNumber(merged.emergencyUntil, 0, Number.MAX_SAFE_INTEGER, 0),
    streak: clampNumber(merged.streak, 0, 10_000, 0),
    lastDoneDateKST: KST_DATE_RE.test(String(merged.lastDoneDateKST || "")) ? String(merged.lastDoneDateKST) : "",
    lastApiError: String(merged.lastApiError || ""),
    history: normalizeHistory(merged.history),
    recentLogs: normalizeLogs(merged.recentLogs)
  };
}

export async function getSettings() {
  const data = await chrome.storage.sync.get("settings");
  return normalizeSettings(data.settings);
}

export async function setSettings(settings) {
  const normalized = normalizeSettings(settings);
  await chrome.storage.sync.set({ settings: normalized });
  return normalized;
}

export async function patchSettings(partial) {
  const cur = await getSettings();
  return setSettings({ ...cur, ...(partial || {}) });
}

export async function getDailyState() {
  const data = await chrome.storage.local.get("dailyState");
  return normalizeDailyState(data.dailyState);
}

export async function setDailyState(dailyState) {
  const normalized = normalizeDailyState(dailyState);
  await chrome.storage.local.set({ dailyState: normalized });
  return normalized;
}

export async function patchDailyState(partial) {
  const cur = await getDailyState();
  return setDailyState({ ...cur, ...(partial || {}) });
}

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function getKSTDateFromTs(ts = Date.now()) {
  return kstFormatter.format(new Date(ts));
}

export function getEffectiveDateKST(settings, nowTs = Date.now()) {
  if (settings?.debugMode && settings?.debugDateKST && KST_DATE_RE.test(settings.debugDateKST)) {
    return settings.debugDateKST;
  }
  return getKSTDateFromTs(nowTs);
}

export function parseDomainList(input) {
  return cleanWhitelist(
    String(input || "")
      .split(/\s|,|\n/)
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function dateFromKstString(dateKST) {
  return new Date(`${dateKST}T00:00:00Z`);
}

function kstStringFromDate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

export function addDaysKST(dateKST, days) {
  const d = dateFromKstString(dateKST);
  d.setUTCDate(d.getUTCDate() + days);
  return kstStringFromDate(d);
}

export function computeStats(dailyState, todayDateKST) {
  const history = normalizeHistory(dailyState.history);
  const doneSet = new Set(history.filter((h) => h.done).map((h) => h.dateKST));
  if (dailyState.solved && todayDateKST) {
    doneSet.add(todayDateKST);
  }
  const solvedToday = Boolean(todayDateKST) && doneSet.has(todayDateKST);

  let streak = 0;
  const start = solvedToday ? todayDateKST : addDaysKST(todayDateKST, -1);
  let cursor = start;
  while (cursor && doneSet.has(cursor)) {
    streak += 1;
    cursor = addDaysKST(cursor, -1);
  }

  let done30 = 0;
  for (let i = 0; i < 30; i += 1) {
    const d = addDaysKST(todayDateKST, -i);
    if (doneSet.has(d)) done30 += 1;
  }

  return {
    streak,
    totalDone: doneSet.size,
    recent30Rate: Math.round((done30 / 30) * 100),
    done30
  };
}

export function upsertHistory(history, row) {
  const next = normalizeHistory(history);
  const idx = next.findIndex((h) => h.dateKST === row.dateKST);
  if (idx >= 0) {
    next[idx] = {
      dateKST: row.dateKST,
      problemId: row.problemId,
      done: Boolean(row.done)
    };
  } else {
    next.push({
      dateKST: row.dateKST,
      problemId: row.problemId,
      done: Boolean(row.done)
    });
  }
  next.sort((a, b) => a.dateKST.localeCompare(b.dateKST));
  return next.slice(-MAX_HISTORY);
}

export function pushRecentLog(logs, entry) {
  const next = normalizeLogs(logs);
  next.push(entry);
  return next.slice(-MAX_LOGS);
}
