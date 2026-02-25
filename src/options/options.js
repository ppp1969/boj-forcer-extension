import { buildTierOptions } from "../shared/picker.js";
import { getTagChoices } from "../shared/solvedac-api.js";
import { DEFAULT_SETTINGS, normalizeSettings, parseDomainList } from "../shared/storage.js";

const EN = {
  optTitle: "BOJ Forcer Settings",
  lblUiLanguage: "Language",
  lblTheme: "Theme",
  optThemeVivid: "Vivid",
  optThemeDark: "Dark",
  optThemeLight: "Light",
  secAccount: "Account",
  lblHandle: "Nickname (solved.ac handle)",
  btnCheck: "Check",
  secFilter: "Problem Filter",
  lblLevelMin: "Min Tier",
  lblLevelMax: "Max Tier",
  lblLangKo: "Language KO",
  lblLangEn: "Language EN",
  lblReqSolvable: "Require Solvable (o?true)",
  lblExcludeWarnings: "Exclude Warnings (w?false)",
  hintReqSolvable: "Only pick problems currently marked solvable on solved.ac.",
  hintExcludeWarnings: "Exclude warning-marked problems.",
  lblMinSolvedCount: "Min Solved Count",
  lblTags: "Problem Tags",
  hintTags: "Default is all selected. Search tags, then uncheck to exclude or switch to include mode.",
  tagSearchPlaceholder: "Search tags (e.g., graph, dp)",
  btnTagSelectAll: "Select All",
  btnTagClearAll: "Clear All",
  btnTagShowMore: "Show More",
  btnTagShowLess: "Show Less",
  tagModeAll: "Mode: all selected (uncheck to exclude)",
  tagModeNone: "Mode: all cleared (check to include)",
  tagSearchEmpty: "No tags match your search.",
  secWhitelist: "Whitelist",
  lblWhitelist: "Domain List",
  secLimits: "Limits",
  lblRerollLimit: "Today Change Per Day",
  lblEmergencyHours: "Emergency Hours",
  lblAutoRecheck: "Auto Check",
  secDebug: "Debug",
  lblDebugMode: "Debug Mode",
  lblDebugDate: "Debug Date (YYYY-MM-DD)",
  hintDebugMode: "Shows richer logs and uses shorter cooldown/retry intervals for testing.",
  btnResetToday: "Reset Today",
  btnFactoryReset: "Factory Reset",
  msgAutoSaving: "Auto-saving...",
  msgAutoSaved: "Auto-saved",
  msgChecking: "Checking...",
  msgHandleRequired: "Enter nickname first.",
  msgHandleValid: "Valid nickname: {handle}",
  msgHandleNotFound: "Nickname does not exist.",
  msgHandleNetwork: "Network error occurred.",
  msgHandleRateLimited: "API rate limit reached. Please try again later.",
  msgHandleUnknown: "Failed to validate nickname.",
  msgResetTodayConfirm:
    "Reset Today: today problem, reroll count, solved status, and last check time will reset. Continue?",
  msgFactoryConfirm:
    "Factory Reset: all settings + local state (history/logs/today state) will be deleted. Continue?"
};

const I18N = {
  en: EN,
  ko: { ...EN }
};

const FALLBACK_TAG_CHOICES = [
  { id: "implementation", en: "Implementation", ko: "Implementation" },
  { id: "data_structures", en: "Data Structures", ko: "Data Structures" },
  { id: "dp", en: "Dynamic Programming", ko: "Dynamic Programming" },
  { id: "graphs", en: "Graph Theory", ko: "Graph Theory" },
  { id: "graph_traversal", en: "Graph Traversal", ko: "Graph Traversal" },
  { id: "greedy", en: "Greedy", ko: "Greedy" },
  { id: "math", en: "Mathematics", ko: "Mathematics" },
  { id: "string", en: "String", ko: "String" },
  { id: "bruteforcing", en: "Bruteforcing", ko: "Bruteforcing" },
  { id: "sorting", en: "Sorting", ko: "Sorting" },
  { id: "binary_search", en: "Binary Search", ko: "Binary Search" },
  { id: "shortest_path", en: "Shortest Path", ko: "Shortest Path" },
  { id: "trees", en: "Tree", ko: "Tree" },
  { id: "ad_hoc", en: "Ad-hoc", ko: "Ad-hoc" },
  { id: "simulation", en: "Simulation", ko: "Simulation" },
  { id: "prefix_sum", en: "Prefix Sum", ko: "Prefix Sum" },
  { id: "two_pointer", en: "Two Pointer", ko: "Two Pointer" }
];

const TAG_CATALOG_CACHE_KEY = "tagCatalogCacheV1";
const TAG_CATALOG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TAG_CATALOG_RETRY_BACKOFF_MS = 12 * 60 * 60 * 1000;
const TAG_COLLAPSED_VISIBLE_COUNT = 60;
const TAG_SELECTION_BASES = new Set(["all", "none"]);
const THEME_VALUES = new Set(["vivid", "dark", "light"]);
const $ = (id) => document.getElementById(id);

const els = {
  optTitle: $("optTitle"),
  lblUiLanguage: $("lblUiLanguage"),
  uiLanguage: $("uiLanguage"),
  lblTheme: $("lblTheme"),
  theme: $("theme"),
  optThemeVivid: $("optThemeVivid"),
  optThemeDark: $("optThemeDark"),
  optThemeLight: $("optThemeLight"),
  secAccount: $("secAccount"),
  lblHandle: $("lblHandle"),
  handle: $("handle"),
  btnValidateHandle: $("btnValidateHandle"),
  handleCheckMsg: $("handleCheckMsg"),
  secFilter: $("secFilter"),
  lblLevelMin: $("lblLevelMin"),
  levelMin: $("levelMin"),
  lblLevelMax: $("lblLevelMax"),
  levelMax: $("levelMax"),
  lblLangKo: $("lblLangKo"),
  langKo: $("langKo"),
  lblLangEn: $("lblLangEn"),
  langEn: $("langEn"),
  lblReqSolvable: $("lblReqSolvable"),
  hintReqSolvable: $("hintReqSolvable"),
  requireSolvable: $("requireSolvable"),
  lblExcludeWarnings: $("lblExcludeWarnings"),
  hintExcludeWarnings: $("hintExcludeWarnings"),
  excludeWarnings: $("excludeWarnings"),
  lblMinSolvedCount: $("lblMinSolvedCount"),
  minSolvedCount: $("minSolvedCount"),
  lblTags: $("lblTags"),
  hintTags: $("hintTags"),
  tagSearch: $("tagSearch"),
  btnTagSelectAll: $("btnTagSelectAll"),
  btnTagClearAll: $("btnTagClearAll"),
  btnTagExpand: $("btnTagExpand"),
  tagModeHint: $("tagModeHint"),
  tagList: $("tagList"),
  tagSearchEmpty: $("tagSearchEmpty"),
  secWhitelist: $("secWhitelist"),
  lblWhitelist: $("lblWhitelist"),
  whitelist: $("whitelist"),
  secLimits: $("secLimits"),
  lblRerollLimit: $("lblRerollLimit"),
  rerollLimitPerDay: $("rerollLimitPerDay"),
  lblEmergencyHours: $("lblEmergencyHours"),
  emergencyHours: $("emergencyHours"),
  lblAutoRecheck: $("lblAutoRecheck"),
  autoRecheck: $("autoRecheck"),
  secDebug: $("secDebug"),
  lblDebugMode: $("lblDebugMode"),
  hintDebugMode: $("hintDebugMode"),
  debugMode: $("debugMode"),
  lblDebugDate: $("lblDebugDate"),
  debugDateKST: $("debugDateKST"),
  btnResetToday: $("btnResetToday"),
  btnFactoryReset: $("btnFactoryReset"),
  saveMsg: $("saveMsg")
};

let tagChecks = new Map();
let tagCatalog = [];
let tagCatalogById = new Map();
let tagSelectionBase = "all";
let isTagListExpanded = false;
let lastMatchedTagCount = 0;
let isHydrating = false;
let saveTimer = null;
let persistedHandle = "";

function t(locale, key) {
  return I18N[locale]?.[key] ?? I18N.en[key] ?? key;
}

function currentLocale() {
  return els.uiLanguage.value === "ko" ? "ko" : "en";
}

function normalizeTheme(theme) {
  return THEME_VALUES.has(theme) ? theme : "vivid";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", normalizeTheme(theme));
}

function formatTemplate(message, values = {}) {
  return Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, String(value ?? "")), message);
}

function normalizeTagId(rawTag) {
  const tag = String(rawTag || "").trim().toLowerCase();
  if (!tag) return "";
  if (tag === "tree") return "trees";
  return tag;
}

function normalizeTagIds(rawTags) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(rawTags) ? rawTags : []) {
    const id = normalizeTagId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeTagChoice(rawChoice) {
  const id = normalizeTagId(rawChoice?.id || rawChoice?.key);
  if (!id) return null;
  const en = String(rawChoice?.en || rawChoice?.name || id).trim() || id;
  const ko = String(rawChoice?.ko || rawChoice?.name || en).trim() || en;
  return { id, en, ko };
}

function normalizeTagChoices(rawChoices) {
  const map = new Map();
  for (const raw of Array.isArray(rawChoices) ? rawChoices : []) {
    const choice = normalizeTagChoice(raw);
    if (!choice || map.has(choice.id)) continue;
    map.set(choice.id, choice);
  }
  return Array.from(map.values());
}

function normalizeTagCatalogCache(rawCache) {
  if (!rawCache || typeof rawCache !== "object") return null;
  const tags = normalizeTagChoices(rawCache.tags);
  if (!tags.length) return null;
  const updatedAt = Number(rawCache.updatedAt || 0);
  const lastFetchFailedAt = Number(rawCache.lastFetchFailedAt || 0);
  return {
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    lastFetchFailedAt: Number.isFinite(lastFetchFailedAt) && lastFetchFailedAt > 0 ? lastFetchFailedAt : 0,
    tags
  };
}

function shouldRefreshTagCatalog(cache, nowTs = Date.now()) {
  if (!cache) return true;
  const isFresh = cache.updatedAt > 0 && nowTs - cache.updatedAt < TAG_CATALOG_CACHE_TTL_MS;
  if (isFresh) return false;
  const failedRecently = cache.lastFetchFailedAt > 0 && nowTs - cache.lastFetchFailedAt < TAG_CATALOG_RETRY_BACKOFF_MS;
  if (failedRecently) return false;
  return true;
}

async function getTagCatalogCache() {
  try {
    const data = await chrome.storage.local.get(TAG_CATALOG_CACHE_KEY);
    return normalizeTagCatalogCache(data?.[TAG_CATALOG_CACHE_KEY]);
  } catch {
    return null;
  }
}

async function setTagCatalogCache(tags, options = {}) {
  const normalizedTags = normalizeTagChoices(tags);
  if (!normalizedTags.length) return;
  const hasUpdatedAt = Object.prototype.hasOwnProperty.call(options, "updatedAt");
  const requestedUpdatedAt = Number(options.updatedAt);
  const payload = {
    updatedAt: hasUpdatedAt && Number.isFinite(requestedUpdatedAt) ? Math.max(0, requestedUpdatedAt) : Date.now(),
    lastFetchFailedAt: Number(options.lastFetchFailedAt || 0),
    tags: normalizedTags
  };
  await chrome.storage.local.set({ [TAG_CATALOG_CACHE_KEY]: payload });
}

function getHandleValidationErrorMessage(locale, errorCode) {
  if (errorCode === "not_found") return t(locale, "msgHandleNotFound");
  if (errorCode === "rate_limited") return t(locale, "msgHandleRateLimited");
  if (errorCode === "offline_or_cors" || errorCode === "timeout") return t(locale, "msgHandleNetwork");
  return t(locale, "msgHandleUnknown");
}

function getHandleValidationSuccessMessage(locale, handle) {
  return formatTemplate(t(locale, "msgHandleValid"), { handle });
}

function getTierRangeFromUserTier(userTier) {
  const tier = Number(userTier);
  if (!Number.isInteger(tier) || tier <= 0) return null;
  return {
    levelMin: Math.max(1, tier - 5),
    levelMax: Math.min(30, tier + 5)
  };
}

async function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function tierOptionsInit() {
  const options = buildTierOptions();
  for (const opt of options) {
    const minOpt = document.createElement("option");
    minOpt.value = String(opt.value);
    minOpt.textContent = opt.label;
    els.levelMin.appendChild(minOpt);

    const maxOpt = document.createElement("option");
    maxOpt.value = String(opt.value);
    maxOpt.textContent = opt.label;
    els.levelMax.appendChild(maxOpt);
  }
}

function getTagLabel(tag, locale) {
  if (!tag) return "";
  if (locale === "ko") return tag.ko || tag.en || tag.id;
  return tag.en || tag.ko || tag.id;
}

function createTagCheckbox(tag) {
  const label = document.createElement("label");
  label.className = "tagItem";
  label.dataset.tagId = tag.id;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.tag = tag.id;
  input.checked = true;
  input.addEventListener("change", () => {
    refreshTagSelectionUi();
    scheduleAutoSave();
  });

  const text = document.createElement("span");
  text.dataset.role = "tagText";

  label.appendChild(input);
  label.appendChild(text);
  return { label, input, text };
}

function updateTagTexts(locale) {
  const labels = els.tagList.querySelectorAll(".tagItem");
  labels.forEach((label) => {
    const tagId = label.dataset.tagId;
    const tag = tagCatalogById.get(tagId);
    const text = label.querySelector('[data-role="tagText"]');
    if (text) text.textContent = getTagLabel(tag, locale) || tagId;
    label.dataset.search = `${tagId} ${tag?.en || ""} ${tag?.ko || ""}`.trim().toLowerCase();
  });
}

function renderTagList() {
  tagChecks = new Map();
  els.tagList.innerHTML = "";
  for (const tag of tagCatalog) {
    const item = createTagCheckbox(tag);
    tagChecks.set(tag.id, item.input);
    els.tagList.appendChild(item.label);
  }
  updateTagTexts(currentLocale());
}

function appendMissingTagChoices(includeTags, excludeTags) {
  const merged = [...normalizeTagIds(includeTags), ...normalizeTagIds(excludeTags)];
  const missing = merged.filter((id) => !tagCatalogById.has(id));
  if (!missing.length) return;

  for (const id of missing) {
    const extra = { id, en: id, ko: id };
    tagCatalog.push(extra);
    tagCatalogById.set(id, extra);

    const item = createTagCheckbox(extra);
    tagChecks.set(extra.id, item.input);
    els.tagList.appendChild(item.label);
  }
  updateTagTexts(currentLocale());
}

function setAllTagsChecked(checked) {
  for (const input of tagChecks.values()) {
    input.checked = checked;
  }
}

function getTagCheckedCount() {
  let checked = 0;
  for (const input of tagChecks.values()) {
    if (input.checked) checked += 1;
  }
  return checked;
}

function applyTagSearchFilter() {
  const q = String(els.tagSearch.value || "").trim().toLowerCase();
  const labels = els.tagList.querySelectorAll(".tagItem");
  const matchedLabels = [];

  labels.forEach((label) => {
    const haystack = String(label.dataset.search || "");
    const matched = !q || haystack.includes(q);
    label.classList.toggle("isHidden", !matched);
    label.classList.remove("isCollapsedHidden");
    if (matched) matchedLabels.push(label);
  });

  lastMatchedTagCount = matchedLabels.length;
  if (!isTagListExpanded && matchedLabels.length > TAG_COLLAPSED_VISIBLE_COUNT) {
    for (let i = TAG_COLLAPSED_VISIBLE_COUNT; i < matchedLabels.length; i += 1) {
      matchedLabels[i].classList.add("isCollapsedHidden");
    }
  }

  const showEmpty = q.length > 0 && matchedLabels.length === 0;
  els.tagSearchEmpty.classList.toggle("isHidden", !showEmpty);
  refreshTagExpandUi();
}

function setTagListExpanded(expanded) {
  isTagListExpanded = Boolean(expanded);
  els.tagList.classList.toggle("isCollapsed", !isTagListExpanded);
  applyTagSearchFilter();
}

function refreshTagExpandUi() {
  const locale = currentLocale();
  const canExpand = lastMatchedTagCount > TAG_COLLAPSED_VISIBLE_COUNT;
  if (!canExpand) {
    isTagListExpanded = false;
    els.tagList.classList.add("isCollapsed");
  }
  els.btnTagExpand.classList.toggle("isHidden", !canExpand);
  els.btnTagExpand.textContent = isTagListExpanded ? t(locale, "btnTagShowLess") : t(locale, "btnTagShowMore");
}

function refreshTagSelectionUi() {
  const locale = currentLocale();
  const checked = getTagCheckedCount();
  const total = tagChecks.size;

  els.btnTagSelectAll.textContent = t(locale, "btnTagSelectAll");
  els.btnTagClearAll.textContent = t(locale, "btnTagClearAll");
  els.tagSearch.placeholder = t(locale, "tagSearchPlaceholder");
  els.tagSearchEmpty.textContent = t(locale, "tagSearchEmpty");
  els.tagModeHint.textContent =
    `${tagSelectionBase === "all" ? t(locale, "tagModeAll") : t(locale, "tagModeNone")} (${checked}/${total})`;
  refreshTagExpandUi();
}

function fillTagSelections(includeTags, excludeTags, savedSelectionBase = "all") {
  appendMissingTagChoices(includeTags, excludeTags);

  const include = new Set(normalizeTagIds(includeTags));
  const exclude = new Set(normalizeTagIds(excludeTags));

  let base = TAG_SELECTION_BASES.has(savedSelectionBase) ? savedSelectionBase : "all";
  if (include.size > 0) base = "none";
  if (include.size === 0 && exclude.size > 0) base = "all";

  tagSelectionBase = base;

  if (tagSelectionBase === "none") {
    setAllTagsChecked(false);
    for (const id of include) {
      const input = tagChecks.get(id);
      if (input) input.checked = true;
    }
  } else {
    setAllTagsChecked(true);
    for (const id of exclude) {
      const input = tagChecks.get(id);
      if (input) input.checked = false;
    }
  }

  refreshTagSelectionUi();
  applyTagSearchFilter();
}

function collectTagFilters() {
  const checked = [];
  const unchecked = [];

  for (const [tagId, input] of tagChecks.entries()) {
    if (input.checked) checked.push(tagId);
    else unchecked.push(tagId);
  }

  if (tagSelectionBase === "none") {
    return {
      tagSelectionBase: "none",
      includeTags: checked,
      excludeTags: []
    };
  }

  return {
    tagSelectionBase: "all",
    includeTags: [],
    excludeTags: unchecked
  };
}

function mergeTagChoices(rawChoices, includeTags, excludeTags) {
  const map = new Map(normalizeTagChoices(rawChoices).map((choice) => [choice.id, choice]));

  const selected = [...normalizeTagIds(includeTags), ...normalizeTagIds(excludeTags)];
  for (const id of selected) {
    if (map.has(id)) continue;
    map.set(id, { id, en: id, ko: id });
  }

  return Array.from(map.values());
}

async function initTagList(filters = DEFAULT_SETTINGS.filters) {
  const includeTags = normalizeTagIds(filters?.includeTags);
  const excludeTags = normalizeTagIds(filters?.excludeTags);
  const nowTs = Date.now();
  const cache = await getTagCatalogCache();
  const baseChoices = cache?.tags?.length ? cache.tags : FALLBACK_TAG_CHOICES;

  tagCatalog = mergeTagChoices(baseChoices, includeTags, excludeTags);
  tagCatalogById = new Map(tagCatalog.map((tag) => [tag.id, tag]));

  renderTagList();
  fillTagSelections(includeTags, excludeTags, filters?.tagSelectionBase);

  if (!shouldRefreshTagCatalog(cache, nowTs)) return;

  try {
    const latest = normalizeTagChoices(await getTagChoices());
    if (!latest.length) return;

    await setTagCatalogCache(latest, { lastFetchFailedAt: 0 });
    tagCatalog = mergeTagChoices(latest, includeTags, excludeTags);
    tagCatalogById = new Map(tagCatalog.map((tag) => [tag.id, tag]));
    renderTagList();
    fillTagSelections(includeTags, excludeTags, filters?.tagSelectionBase);
  } catch {
    if (cache?.tags?.length) {
      await setTagCatalogCache(cache.tags, {
        updatedAt: cache.updatedAt,
        lastFetchFailedAt: nowTs
      });
      return;
    }
    await setTagCatalogCache(FALLBACK_TAG_CHOICES, {
      updatedAt: 0,
      lastFetchFailedAt: nowTs
    });
  }
}

function applyLocale(locale) {
  const l = locale === "ko" ? "ko" : "en";
  els.optTitle.textContent = t(l, "optTitle");
  els.lblUiLanguage.textContent = t(l, "lblUiLanguage");
  els.lblTheme.textContent = t(l, "lblTheme");
  els.optThemeVivid.textContent = t(l, "optThemeVivid");
  els.optThemeDark.textContent = t(l, "optThemeDark");
  els.optThemeLight.textContent = t(l, "optThemeLight");
  els.secAccount.textContent = t(l, "secAccount");
  els.lblHandle.textContent = t(l, "lblHandle");
  els.btnValidateHandle.textContent = t(l, "btnCheck");
  els.secFilter.textContent = t(l, "secFilter");
  els.lblLevelMin.textContent = t(l, "lblLevelMin");
  els.lblLevelMax.textContent = t(l, "lblLevelMax");
  els.lblLangKo.textContent = t(l, "lblLangKo");
  els.lblLangEn.textContent = t(l, "lblLangEn");
  els.lblReqSolvable.textContent = t(l, "lblReqSolvable");
  els.hintReqSolvable.textContent = t(l, "hintReqSolvable");
  els.lblExcludeWarnings.textContent = t(l, "lblExcludeWarnings");
  els.hintExcludeWarnings.textContent = t(l, "hintExcludeWarnings");
  els.lblMinSolvedCount.textContent = t(l, "lblMinSolvedCount");
  els.lblTags.textContent = t(l, "lblTags");
  els.hintTags.textContent = t(l, "hintTags");
  els.secWhitelist.textContent = t(l, "secWhitelist");
  els.lblWhitelist.textContent = t(l, "lblWhitelist");
  els.secLimits.textContent = t(l, "secLimits");
  els.lblRerollLimit.textContent = t(l, "lblRerollLimit");
  els.lblEmergencyHours.textContent = t(l, "lblEmergencyHours");
  els.lblAutoRecheck.textContent = t(l, "lblAutoRecheck");
  els.secDebug.textContent = t(l, "secDebug");
  els.lblDebugMode.textContent = t(l, "lblDebugMode");
  els.hintDebugMode.textContent = t(l, "hintDebugMode");
  els.lblDebugDate.textContent = t(l, "lblDebugDate");
  els.btnResetToday.textContent = t(l, "btnResetToday");
  els.btnFactoryReset.textContent = t(l, "btnFactoryReset");

  updateTagTexts(l);
  refreshTagSelectionUi();
  applyTagSearchFilter();
}

function fillForm(settings, options = {}) {
  const preserveHandleDraft = options.preserveHandleDraft === true;
  isHydrating = true;
  try {
    persistedHandle = String(settings.handle || "");
    els.uiLanguage.value = settings.uiLanguage === "ko" ? "ko" : "en";
    els.theme.value = normalizeTheme(settings.theme);
    applyTheme(els.theme.value);
    applyLocale(els.uiLanguage.value);

    if (!preserveHandleDraft) {
      els.handle.value = persistedHandle;
    }
    els.levelMin.value = String(settings.filters.levelMin);
    els.levelMax.value = String(settings.filters.levelMax);
    els.langKo.checked = settings.filters.languages.includes("ko");
    els.langEn.checked = settings.filters.languages.includes("en");
    els.requireSolvable.checked = settings.filters.requireSolvable;
    els.excludeWarnings.checked = settings.filters.excludeWarnings;
    els.minSolvedCount.value = String(Math.max(1, Number(settings.filters.minSolvedCount || 1)));
    fillTagSelections(settings.filters.includeTags, settings.filters.excludeTags, settings.filters.tagSelectionBase);
    els.whitelist.value = settings.whitelist.join("\n");
    els.rerollLimitPerDay.value = String(settings.rerollLimitPerDay);
    els.emergencyHours.value = String(settings.emergencyHours);
    els.autoRecheck.checked = settings.autoRecheck !== false;
    els.debugMode.checked = settings.debugMode;
    els.debugDateKST.value = settings.debugDateKST || "";
  } finally {
    isHydrating = false;
  }
}

function collectForm(options = {}) {
  const includeHandle = options.includeHandle === true;
  const handleOverride = typeof options.handleOverride === "string" ? options.handleOverride : null;
  const handleValue = includeHandle ? handleOverride ?? els.handle.value.trim() : persistedHandle;
  const tagFilters = collectTagFilters();

  const settings = {
    ...DEFAULT_SETTINGS,
    handle: handleValue,
    uiLanguage: currentLocale(),
    theme: normalizeTheme(els.theme.value),
    filters: {
      levelMin: Number(els.levelMin.value),
      levelMax: Number(els.levelMax.value),
      languages: [els.langKo.checked ? "ko" : "", els.langEn.checked ? "en" : ""].filter(Boolean),
      requireSolvable: els.requireSolvable.checked,
      excludeWarnings: els.excludeWarnings.checked,
      minSolvedCount: Math.max(1, Number(els.minSolvedCount.value || 1)),
      tagSelectionBase: tagFilters.tagSelectionBase,
      includeTags: tagFilters.includeTags,
      excludeTags: tagFilters.excludeTags
    },
    whitelist: parseDomainList(els.whitelist.value),
    rerollLimitPerDay: Number(els.rerollLimitPerDay.value || 0),
    emergencyHours: Number(els.emergencyHours.value || 3),
    autoRecheck: els.autoRecheck.checked,
    debugMode: els.debugMode.checked,
    debugDateKST: els.debugDateKST.value.trim() || null
  };

  return normalizeSettings(settings);
}

async function saveNow(options = {}) {
  const includeHandle = options.includeHandle === true;
  const handleOverride = typeof options.handleOverride === "string" ? options.handleOverride : null;
  const locale = currentLocale();

  els.saveMsg.textContent = t(locale, "msgAutoSaving");
  const settings = collectForm({ includeHandle, handleOverride });
  const res = await send("SAVE_SETTINGS", { settings });
  if (!res?.ok) throw new Error(res?.error || "save_failed");

  fillForm(res.snapshot.settings, { preserveHandleDraft: !includeHandle });
  els.saveMsg.textContent = t(locale, "msgAutoSaved");
}

function scheduleAutoSave() {
  if (isHydrating) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow().catch((err) => {
      els.saveMsg.textContent = String(err?.message || err);
    });
  }, 350);
}

function bindAutoSaveInputs() {
  const controls = [
    els.uiLanguage,
    els.theme,
    els.levelMin,
    els.levelMax,
    els.langKo,
    els.langEn,
    els.requireSolvable,
    els.excludeWarnings,
    els.minSolvedCount,
    els.whitelist,
    els.rerollLimitPerDay,
    els.emergencyHours,
    els.autoRecheck,
    els.debugMode,
    els.debugDateKST
  ];

  controls.forEach((el) => {
    if (!el) return;
    el.addEventListener("change", scheduleAutoSave);
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.addEventListener("input", scheduleAutoSave);
    }
  });

  els.uiLanguage.addEventListener("change", () => {
    applyLocale(currentLocale());
  });
  els.theme.addEventListener("change", () => {
    applyTheme(els.theme.value);
  });
}

function bindTagControls() {
  els.tagSearch.addEventListener("input", applyTagSearchFilter);

  els.btnTagSelectAll.addEventListener("click", () => {
    tagSelectionBase = "all";
    setAllTagsChecked(true);
    refreshTagSelectionUi();
    applyTagSearchFilter();
    scheduleAutoSave();
  });

  els.btnTagClearAll.addEventListener("click", () => {
    tagSelectionBase = "none";
    setAllTagsChecked(false);
    refreshTagSelectionUi();
    applyTagSearchFilter();
    scheduleAutoSave();
  });

  els.btnTagExpand.addEventListener("click", () => {
    setTagListExpanded(!isTagListExpanded);
  });

  window.addEventListener("resize", () => {
    applyTagSearchFilter();
  });
}

async function load() {
  tierOptionsInit();
  bindAutoSaveInputs();
  bindTagControls();

  const res = await send("GET_SNAPSHOT");
  if (!res?.ok) throw new Error(res?.error || "load_failed");

  await initTagList(res.snapshot.settings?.filters || DEFAULT_SETTINGS.filters);
  fillForm(res.snapshot.settings);
  els.saveMsg.textContent = t(currentLocale(), "msgAutoSaved");
}

els.btnResetToday.addEventListener("click", async () => {
  const locale = currentLocale();
  if (!confirm(t(locale, "msgResetTodayConfirm"))) return;
  const res = await send("RESET_TODAY");
  els.saveMsg.textContent = res?.ok ? "OK" : String(res?.error || "failed");
});

els.btnFactoryReset.addEventListener("click", async () => {
  const locale = currentLocale();
  if (!confirm(t(locale, "msgFactoryConfirm"))) return;
  const res = await send("FACTORY_RESET");
  if (!res?.ok) {
    els.saveMsg.textContent = String(res?.error || "failed");
    return;
  }
  fillForm(res.snapshot.settings);
  els.saveMsg.textContent = "OK";
});

els.btnValidateHandle.addEventListener("click", async () => {
  const locale = currentLocale();
  const handle = els.handle.value.trim();
  if (!handle) {
    els.handleCheckMsg.textContent = t(locale, "msgHandleRequired");
    return;
  }

  els.handleCheckMsg.textContent = t(locale, "msgChecking");
  const res = await send("VALIDATE_HANDLE", { handle });
  if (!res?.ok) {
    els.handleCheckMsg.textContent = getHandleValidationErrorMessage(locale, String(res?.error || ""));
    return;
  }

  const normalizedHandle = String(res.user?.handle || handle);
  const tierRange = getTierRangeFromUserTier(res.user?.tier);
  if (tierRange) {
    els.levelMin.value = String(tierRange.levelMin);
    els.levelMax.value = String(tierRange.levelMax);
  }

  try {
    await saveNow({ includeHandle: true, handleOverride: normalizedHandle });
    els.handleCheckMsg.textContent = getHandleValidationSuccessMessage(locale, normalizedHandle);
  } catch (err) {
    els.handleCheckMsg.textContent = t(locale, "msgHandleUnknown");
    els.saveMsg.textContent = String(err?.message || err);
  }
});

load().catch((err) => {
  els.saveMsg.textContent = String(err?.message || err);
});
