import { buildTierOptions } from "../shared/picker.js";
import { DEFAULT_SETTINGS, normalizeSettings, parseDomainList } from "../shared/storage.js";

const I18N = {
  en: {
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
    hintTags: "All tags are selected by default. Uncheck tags you want to exclude.",
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
  },
  ko: {
    optTitle: "BOJ Forcer 설정",
    lblUiLanguage: "언어",
    lblTheme: "테마",
    optThemeVivid: "기본 비주얼",
    optThemeDark: "다크",
    optThemeLight: "라이트",
    secAccount: "계정",
    lblHandle: "닉네임 (solved.ac 핸들)",
    btnCheck: "확인",
    secFilter: "문제 필터",
    lblLevelMin: "최소 티어",
    lblLevelMax: "최대 티어",
    lblLangKo: "한국어",
    lblLangEn: "영어",
    lblReqSolvable: "풀 수 있는 문제만 (o?true)",
    lblExcludeWarnings: "경고 제외 (w?false)",
    hintReqSolvable: "solved.ac에서 풀이 가능으로 표시된 문제만 선택합니다.",
    hintExcludeWarnings: "경고가 붙은 문제를 제외합니다.",
    lblMinSolvedCount: "최소 해결 수",
    lblTags: "문제 태그",
    hintTags: "기본값은 모두 선택입니다. 제외할 태그만 체크 해제하세요.",
    secWhitelist: "화이트리스트",
    lblWhitelist: "도메인 목록",
    secLimits: "제한",
    lblRerollLimit: "하루 변경 횟수",
    lblEmergencyHours: "Emergency 시간",
    lblAutoRecheck: "자동 검사",
    secDebug: "디버그",
    lblDebugMode: "디버그 모드",
    lblDebugDate: "디버그 날짜 (YYYY-MM-DD)",
    hintDebugMode: "테스트용으로 로그가 늘고 쿨다운/재시도 간격이 짧아집니다.",
    btnResetToday: "오늘 초기화",
    btnFactoryReset: "전체 초기화",
    msgAutoSaving: "자동 저장 중...",
    msgAutoSaved: "자동 저장됨",
    msgChecking: "확인 중...",
    msgHandleRequired: "닉네임을 입력하세요.",
    msgResetTodayConfirm: "오늘 상태(문제/리롤/완료/검사시간)를 초기화합니다. 진행할까요?",
    msgFactoryConfirm: "설정과 로컬 상태(히스토리/로그/오늘 상태)를 모두 삭제합니다. 진행할까요?"
  }
};

const TAG_CHOICES = [
  { id: "implementation", en: "Implementation", ko: "구현" },
  { id: "data_structures", en: "Data Structures", ko: "자료구조" },
  { id: "dp", en: "DP", ko: "동적 계획법" },
  { id: "graphs", en: "Graph", ko: "그래프" },
  { id: "graph_traversal", en: "Graph Traversal", ko: "그래프 탐색" },
  { id: "greedy", en: "Greedy", ko: "그리디" },
  { id: "math", en: "Math", ko: "수학" },
  { id: "string", en: "String", ko: "문자열" },
  { id: "bruteforcing", en: "Bruteforce", ko: "브루트포스" },
  { id: "sorting", en: "Sorting", ko: "정렬" },
  { id: "binary_search", en: "Binary Search", ko: "이분 탐색" },
  { id: "shortest_path", en: "Shortest Path", ko: "최단 경로" },
  { id: "tree", en: "Tree", ko: "트리" },
  { id: "ad_hoc", en: "Ad-hoc", ko: "애드혹" },
  { id: "simulation", en: "Simulation", ko: "시뮬레이션" },
  { id: "prefix_sum", en: "Prefix Sum", ko: "누적 합" },
  { id: "two_pointer", en: "Two Pointers", ko: "투 포인터" }
];

const $ = (id) => document.getElementById(id);
const THEME_VALUES = new Set(["vivid", "dark", "light"]);

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
  tagList: $("tagList"),
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
let isHydrating = false;
let saveTimer = null;

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

function getHandleValidationErrorMessage(locale, errorCode) {
  const isKo = locale === "ko";
  if (errorCode === "not_found") return isKo ? "존재하지 않는 닉네임입니다." : t(locale, "msgHandleNotFound");
  if (errorCode === "rate_limited") return isKo ? "API 요청 제한 중입니다." : t(locale, "msgHandleRateLimited");
  if (errorCode === "offline_or_cors" || errorCode === "timeout") {
    return isKo ? "네트워크 오류가 발생했습니다." : t(locale, "msgHandleNetwork");
  }
  return t(locale, "msgHandleUnknown");
}

function getHandleValidationSuccessMessage(locale, handle) {
  if (locale === "ko") return `유효한 닉네임입니다: ${handle}`;
  return formatTemplate(t(locale, "msgHandleValid"), { handle });
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

function createTagCheckbox(tag) {
  const label = document.createElement("label");
  label.className = "tagItem";
  label.dataset.tagId = tag.id;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.tag = tag.id;
  input.checked = true;

  const text = document.createElement("span");
  text.dataset.role = "tagText";

  label.appendChild(input);
  label.appendChild(text);
  return { label, input, text };
}

function updateTagTexts(locale) {
  const langKey = locale === "ko" ? "ko" : "en";
  const tagMap = new Map(TAG_CHOICES.map((tag) => [tag.id, tag[langKey] || tag.en]));
  const labels = els.tagList.querySelectorAll(".tagItem");
  labels.forEach((label) => {
    const tagId = label.dataset.tagId;
    const text = label.querySelector('[data-role="tagText"]');
    if (text) text.textContent = tagMap.get(tagId) || tagId;
  });
}

function initTagList() {
  tagChecks = new Map();
  els.tagList.innerHTML = "";
  for (const tag of TAG_CHOICES) {
    const item = createTagCheckbox(tag);
    item.input.addEventListener("change", scheduleAutoSave);
    tagChecks.set(tag.id, item.input);
    els.tagList.appendChild(item.label);
  }
  updateTagTexts(currentLocale());
}

function setAllTagsChecked() {
  for (const input of tagChecks.values()) input.checked = true;
}

function fillTagSelections(includeTags, excludeTags) {
  const include = new Set(Array.isArray(includeTags) ? includeTags : []);
  const exclude = new Set(Array.isArray(excludeTags) ? excludeTags : []);

  if (include.size > 0) {
    for (const [tagId, input] of tagChecks.entries()) {
      input.checked = include.has(tagId);
    }
    return;
  }

  setAllTagsChecked();
  for (const [tagId, input] of tagChecks.entries()) {
    if (exclude.has(tagId)) input.checked = false;
  }
}

function selectedExcludedTags() {
  const out = [];
  for (const [tagId, input] of tagChecks.entries()) {
    if (!input.checked) out.push(tagId);
  }
  return out;
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
}

function fillForm(settings) {
  isHydrating = true;
  try {
    els.uiLanguage.value = settings.uiLanguage === "ko" ? "ko" : "en";
    els.theme.value = normalizeTheme(settings.theme);
    applyTheme(els.theme.value);
    applyLocale(els.uiLanguage.value);

    els.handle.value = settings.handle;
    els.levelMin.value = String(settings.filters.levelMin);
    els.levelMax.value = String(settings.filters.levelMax);
    els.langKo.checked = settings.filters.languages.includes("ko");
    els.langEn.checked = settings.filters.languages.includes("en");
    els.requireSolvable.checked = settings.filters.requireSolvable;
    els.excludeWarnings.checked = settings.filters.excludeWarnings;
    els.minSolvedCount.value = String(Math.max(1, Number(settings.filters.minSolvedCount || 1)));
    fillTagSelections(settings.filters.includeTags, settings.filters.excludeTags);
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

function collectForm() {
  const settings = {
    ...DEFAULT_SETTINGS,
    handle: els.handle.value.trim(),
    uiLanguage: currentLocale(),
    theme: normalizeTheme(els.theme.value),
    filters: {
      levelMin: Number(els.levelMin.value),
      levelMax: Number(els.levelMax.value),
      languages: [els.langKo.checked ? "ko" : "", els.langEn.checked ? "en" : ""].filter(Boolean),
      requireSolvable: els.requireSolvable.checked,
      excludeWarnings: els.excludeWarnings.checked,
      minSolvedCount: Math.max(1, Number(els.minSolvedCount.value || 1)),
      includeTags: [],
      excludeTags: selectedExcludedTags()
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

async function saveNow() {
  const locale = currentLocale();
  els.saveMsg.textContent = t(locale, "msgAutoSaving");
  const settings = collectForm();
  const res = await send("SAVE_SETTINGS", { settings });
  if (!res?.ok) throw new Error(res?.error || "save_failed");
  fillForm(res.snapshot.settings);
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
    els.handle,
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

async function load() {
  tierOptionsInit();
  initTagList();
  bindAutoSaveInputs();
  const res = await send("GET_SNAPSHOT");
  if (!res?.ok) throw new Error(res?.error || "load_failed");
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
  els.handleCheckMsg.textContent = getHandleValidationSuccessMessage(locale, res.user?.handle || handle);
});

load().catch((err) => {
  els.saveMsg.textContent = String(err?.message || err);
});
