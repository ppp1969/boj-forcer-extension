import { levelToTierLabel } from "../shared/picker.js";

const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    title: "BOJ Forcer",
    rerollRemaining: "Today Change",
    reroll: "Random Pick",
    numberPick: "Pick Number",
    numberHint: "e.g. 1000",
    changeHelpText:
      "Random Pick uses your current filters. Pick Number sets today's problem directly by BOJ number. Both share the same daily change count.",
    recheck: "Check",
    openProblem: "Open Problem",
    settings: "Settings",
    streak: "Streak",
    total: "Total",
    rate: "30d",
    lastCheck: "Last check",
    tier: "Tier",
    noProblem: "No problem selected",
    emergency: "Emergency",
    statusDone: "DONE",
    statusPending: "PENDING",
    statusEmergency: "EMERGENCY",
    bannerMissingHandle: "Set nickname in Settings first.",
    err_missing_handle: "Set your nickname first.",
    err_no_candidates: "No candidates. Relax filters.",
    err_reroll_limit: "Today change limit reached.",
    err_invalid_problem_id: "Enter a valid problem number.",
    err_problem_not_found: "Problem not found.",
    err_rate_limited: "Rate limited by solved.ac.",
    err_server_error: "solved.ac server error.",
    err_offline_or_cors: "Network error.",
    err_timeout: "Request timeout.",
    err_emergency_used_today: "Emergency already used today."
  },
  ko: {
    title: "BOJ Forcer",
    rerollRemaining: "오늘 문제 변경",
    reroll: "랜덤뽑기",
    numberPick: "번호 지정",
    numberHint: "예: 1000",
    changeHelpText:
      "랜덤뽑기는 현재 필터 기준으로 문제를 바꿉니다. 번호 지정은 BOJ 번호로 오늘 문제를 직접 바꿉니다. 두 방식 모두 같은 일일 변경 횟수를 사용합니다.",
    recheck: "검사",
    openProblem: "문제 열기",
    settings: "설정",
    streak: "연속",
    total: "총 완료",
    rate: "30일",
    lastCheck: "마지막 검사",
    tier: "티어",
    noProblem: "문제가 선택되지 않았습니다",
    emergency: "Emergency",
    statusDone: "완료",
    statusPending: "대기",
    statusEmergency: "긴급",
    bannerMissingHandle: "설정에서 닉네임을 먼저 입력하세요.",
    err_missing_handle: "닉네임을 먼저 입력하세요.",
    err_no_candidates: "후보 문제가 없습니다. 필터를 완화하세요.",
    err_reroll_limit: "오늘 변경 한도를 초과했습니다.",
    err_invalid_problem_id: "유효한 문제 번호를 입력하세요.",
    err_problem_not_found: "문제를 찾을 수 없습니다.",
    err_rate_limited: "solved.ac 요청 제한입니다.",
    err_server_error: "solved.ac 서버 오류입니다.",
    err_offline_or_cors: "네트워크 오류입니다.",
    err_timeout: "요청 시간이 초과되었습니다.",
    err_emergency_used_today: "오늘 Emergency를 이미 사용했습니다."
  }
};

const els = {
  txtTitle: $("txtTitle"),
  statusBadge: $("statusBadge"),
  nicknameBanner: $("nicknameBanner"),
  problemLink: $("problemLink"),
  problemTitle: $("problemTitle"),
  problemMeta: $("problemMeta"),
  btnOpenToday: $("btnOpenToday"),
  txtRerollRemaining: $("txtRerollRemaining"),
  rerollCount: $("rerollCount"),
  rerollBar: $("rerollBar"),
  btnReroll: $("btnReroll"),
  btnSetNumber: $("btnSetNumber"),
  inputProblemNumber: $("inputProblemNumber"),
  btnChangeHelp: $("btnChangeHelp"),
  btnRecheck: $("btnRecheck"),
  btnEmergencyToggle: $("btnEmergencyToggle"),
  txtStreak: $("txtStreak"),
  txtTotal: $("txtTotal"),
  txtRate: $("txtRate"),
  statStreak: $("statStreak"),
  statTotal: $("statTotal"),
  statRate: $("statRate"),
  lastCheckText: $("lastCheckText"),
  errorText: $("errorText"),
  btnOptions: $("btnOptions")
};

let latestSnapshot = null;
let recheckLoading = false;
let popupSessionOpened = false;
let popupSessionClosedNotified = false;

function t(locale, key) {
  return I18N[locale]?.[key] ?? I18N.en[key] ?? key;
}

function localizeError(locale, code) {
  if (!code) return "";
  const key = `err_${code}`;
  return t(locale, key);
}

function applyTheme(theme) {
  const root = document.documentElement;
  const normalized = theme === "dark" || theme === "light" ? theme : "vivid";
  root.setAttribute("data-theme", normalized);
}

function formatLastCheckAgo(ts) {
  if (!ts) return "-";
  const elapsedMs = Math.max(0, Date.now() - Number(ts));
  const elapsedMin = Math.floor(elapsedMs / 60000);
  if (elapsedMin < 1) return "just now";
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function formatRemainingMs(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function statusBadgeClass(status) {
  if (status === "DONE") return "badge ok";
  if (status === "EMERGENCY") return "badge warn";
  return "badge danger";
}

function applyStaticText(locale) {
  els.txtTitle.textContent = t(locale, "title");
  els.txtRerollRemaining.textContent = t(locale, "rerollRemaining");
  els.btnReroll.textContent = t(locale, "reroll");
  els.btnSetNumber.textContent = t(locale, "numberPick");
  els.inputProblemNumber.placeholder = t(locale, "numberHint");
  els.btnRecheck.textContent = t(locale, "recheck");
  els.btnOpenToday.textContent = t(locale, "openProblem");
  els.btnOptions.textContent = t(locale, "settings");
  els.txtStreak.textContent = t(locale, "streak");
  els.txtTotal.textContent = t(locale, "total");
  els.txtRate.textContent = t(locale, "rate");
}

function renderEmergencyButton(snapshot, locale) {
  const { emergencyActive, emergencyCanActivate, emergencyRemainingMs } = snapshot;
  els.btnEmergencyToggle.textContent = t(locale, "emergency");
  els.btnEmergencyToggle.classList.remove("emergencyActive", "emergencyReady", "emergencyLocked");

  if (emergencyActive) {
    els.btnEmergencyToggle.disabled = false;
    els.btnEmergencyToggle.classList.add("emergencyActive");
    els.btnEmergencyToggle.textContent = `${t(locale, "emergency")} ${formatRemainingMs(emergencyRemainingMs)}`;
    return;
  }
  if (!emergencyCanActivate) {
    els.btnEmergencyToggle.disabled = true;
    els.btnEmergencyToggle.classList.add("emergencyLocked");
    return;
  }
  els.btnEmergencyToggle.disabled = false;
  els.btnEmergencyToggle.classList.add("emergencyReady");
}

function render(snapshot) {
  latestSnapshot = snapshot;
  const locale = snapshot?.settings?.uiLanguage === "ko" ? "ko" : "en";
  applyTheme(snapshot?.settings?.theme);
  applyStaticText(locale);

  const { settings, daily, status, problemUrl, problemTitle, problemLevel, rerollRemaining, stats } = snapshot;

  els.statusBadge.className = statusBadgeClass(status);
  els.statusBadge.textContent =
    status === "DONE" ? t(locale, "statusDone") : status === "EMERGENCY" ? t(locale, "statusEmergency") : t(locale, "statusPending");

  if (daily.todayProblemId) {
    els.problemLink.textContent = `#${daily.todayProblemId}`;
    els.problemLink.href = problemUrl;
    els.problemTitle.textContent = problemTitle || "";
    const tierText = problemLevel > 0 ? levelToTierLabel(problemLevel) : "-";
    els.problemMeta.textContent = `${t(locale, "tier")}: ${tierText}`;
  } else {
    els.problemLink.textContent = "-";
    els.problemLink.href = "#";
    els.problemTitle.textContent = "";
    els.problemMeta.textContent = t(locale, "noProblem");
  }

  const missingHandle = !settings.handle;
  els.nicknameBanner.hidden = !missingHandle;
  els.nicknameBanner.textContent = t(locale, "bannerMissingHandle");

  const rerollLimit = Number(settings.rerollLimitPerDay || 0);
  const changeUsed = Math.max(0, Number(daily.rerollUsed || 0));
  const shownUsed = rerollLimit > 0 ? Math.min(rerollLimit, changeUsed) : changeUsed;
  const ratio = rerollLimit <= 0 ? 0 : (shownUsed / rerollLimit) * 100;
  els.rerollBar.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
  els.rerollCount.textContent = `${shownUsed} / ${rerollLimit}`;

  const canChangeTodayProblem = rerollRemaining > 0 && Boolean(settings.handle);
  els.btnReroll.disabled = !canChangeTodayProblem || recheckLoading;
  els.btnSetNumber.disabled = !canChangeTodayProblem || recheckLoading;
  els.inputProblemNumber.disabled = !canChangeTodayProblem || recheckLoading;
  els.btnRecheck.disabled = recheckLoading || !daily.todayProblemId;
  els.btnRecheck.classList.toggle("isLoading", recheckLoading);
  renderEmergencyButton(snapshot, locale);

  els.statStreak.textContent = String(stats.streak);
  els.statTotal.textContent = String(stats.totalDone);
  els.statRate.textContent = `${stats.recent30Rate}%`;
  els.lastCheckText.textContent = `${t(locale, "lastCheck")}: ${formatLastCheckAgo(daily.lastSolvedCheckAt)}`;
  els.errorText.textContent = localizeError(locale, daily.lastApiError);
}

async function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

async function refresh(opened = false) {
  if (opened) popupSessionOpened = true;
  const res = await send(opened ? "POPUP_OPENED" : "GET_SNAPSHOT");
  if (!res?.ok) throw new Error(res?.error || "load_failed");
  render(res.snapshot);
}

function notifyPopupClosed() {
  if (!popupSessionOpened || popupSessionClosedNotified) return;
  popupSessionClosedNotified = true;
  send("POPUP_CLOSED").catch(() => {});
}

els.btnRecheck.addEventListener("click", async () => {
  if (recheckLoading) return;
  recheckLoading = true;
  if (latestSnapshot) render(latestSnapshot);
  try {
    const res = await send("RECHECK");
    if (!res?.ok) throw new Error(res?.error || "recheck_failed");
    render(res.snapshot);
  } catch (err) {
    if (latestSnapshot) {
      const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
      els.errorText.textContent = localizeError(locale, String(err?.message || err));
    }
  } finally {
    recheckLoading = false;
    if (latestSnapshot) render(latestSnapshot);
  }
});

els.btnReroll.addEventListener("click", async () => {
  try {
    const res = await send("REROLL");
    if (!res?.ok) throw new Error(res?.error || "reroll_failed");
    render(res.snapshot);
  } catch (err) {
    if (!latestSnapshot) return;
    const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
    els.errorText.textContent = localizeError(locale, String(err?.message || err));
  }
});

els.btnSetNumber.addEventListener("click", async () => {
  const raw = String(els.inputProblemNumber.value || "").trim();
  if (!raw) {
    if (!latestSnapshot) return;
    const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
    els.errorText.textContent = localizeError(locale, "invalid_problem_id");
    return;
  }
  try {
    const res = await send("CHANGE_TODAY_PROBLEM_BY_NUMBER", { problemId: raw });
    if (!res?.ok) throw new Error(res?.error || "change_problem_failed");
    els.inputProblemNumber.value = "";
    render(res.snapshot);
  } catch (err) {
    if (!latestSnapshot) return;
    const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
    els.errorText.textContent = localizeError(locale, String(err?.message || err));
  }
});

els.inputProblemNumber.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  els.btnSetNumber.click();
});

els.btnChangeHelp.addEventListener("click", () => {
  const locale = latestSnapshot?.settings?.uiLanguage === "ko" ? "ko" : "en";
  window.alert(t(locale, "changeHelpText"));
});

els.btnEmergencyToggle.addEventListener("click", async () => {
  try {
    const res = await send("TOGGLE_EMERGENCY");
    if (!res?.ok) throw new Error(res?.error || "emergency_failed");
    render(res.snapshot);
  } catch (err) {
    if (!latestSnapshot) return;
    const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
    els.errorText.textContent = localizeError(locale, String(err?.message || err));
  }
});

els.btnOpenToday.addEventListener("click", async () => {
  await send("OPEN_TODAY");
});

els.btnOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh(true).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});

window.addEventListener("pagehide", notifyPopupClosed);
window.addEventListener("unload", notifyPopupClosed);
