const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    title: "BOJ Forcer",
    todayLabel: "Today's Problem",
    openProblem: "Open Problem",
    checkCompletion: "Check Completion",
    changeHeader: "Change Today's Problem",
    randomPick: "Random Pick",
    enterNumber: "Problem Number",
    numberHint: "Problem number (e.g. 1000)",
    apply: "Change",
    changeHelpText:
      "Random Pick changes today's problem with your current filters. Problem Number changes today's problem directly by BOJ number. Both use the same daily change count.",
    settings: "Settings",
    streak: "Streak",
    total: "Total",
    rate: "30d",
    lastCheck: "Last check",
    noProblem: "No problem selected",
    emergency: "Emergency Unlock",
    statusDone: "CLEARED",
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
    todayLabel: "오늘의 문제",
    openProblem: "문제 열기",
    checkCompletion: "완료 체크",
    changeHeader: "오늘 문제 변경",
    randomPick: "랜덤뽑기",
    enterNumber: "문제번호",
    numberHint: "문제번호 입력 (예시: 1000)",
    apply: "변경",
    changeHelpText:
      "랜덤뽑기는 현재 필터 기준으로 오늘 문제를 바꿉니다. 문제번호는 BOJ 번호로 오늘 문제를 직접 바꿉니다. 두 방식 모두 같은 일일 변경 횟수를 사용합니다.",
    settings: "설정",
    streak: "연속",
    total: "총 완료",
    rate: "30일",
    lastCheck: "마지막 검사",
    noProblem: "선택된 문제가 없습니다.",
    emergency: "Emergency Unlock",
    statusDone: "완료",
    statusPending: "대기",
    statusEmergency: "긴급",
    bannerMissingHandle: "설정에서 닉네임을 먼저 입력하세요.",
    err_missing_handle: "닉네임을 먼저 입력하세요.",
    err_no_candidates: "후보 문제가 없습니다. 필터를 완화하세요.",
    err_reroll_limit: "오늘 변경 시도를 초과했습니다.",
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
  txtTodayLabel: $("txtTodayLabel"),
  txtCheckCompletion: $("txtCheckCompletion"),
  txtChangeHeader: $("txtChangeHeader"),
  txtStreak: $("txtStreak"),
  txtTotal: $("txtTotal"),
  txtRate: $("txtRate"),
  statusBadge: $("statusBadge"),
  nicknameBanner: $("nicknameBanner"),
  problemLink: $("problemLink"),
  problemTitle: $("problemTitle"),
  tierBadge: $("tierBadge"),
  btnOpenToday: $("btnOpenToday"),
  btnRecheck: $("btnRecheck"),
  btnChangeToggle: $("btnChangeToggle"),
  changeCaret: $("changeCaret"),
  changePanel: $("changePanel"),
  btnReroll: $("btnReroll"),
  btnEnterMode: $("btnEnterMode"),
  numberEntryRow: $("numberEntryRow"),
  inputProblemNumber: $("inputProblemNumber"),
  btnSetNumber: $("btnSetNumber"),
  btnChangeHelp: $("btnChangeHelp"),
  btnEmergencyToggle: $("btnEmergencyToggle"),
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
let changePanelOpen = true;
let changeMode = "random";

function t(locale, key) {
  return I18N[locale]?.[key] ?? I18N.en[key] ?? key;
}

function localizeError(locale, code) {
  if (!code) return "";
  return t(locale, `err_${code}`);
}

function applyTheme(theme) {
  const root = document.documentElement;
  const normalized = theme === "dark" || theme === "light" ? theme : "vivid";
  root.setAttribute("data-theme", normalized);
}

function pad2(num) {
  return String(num).padStart(2, "0");
}

function formatLastCheckTime(ts) {
  if (!ts) return "-";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}:${pad2(date.getSeconds())}`;
}

function formatRemainingMs(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function getTierBadgePath(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return "../../assets/tiers/0.svg";
  const clamped = Math.max(0, Math.min(31, Math.floor(n)));
  return `../../assets/tiers/${clamped}.svg`;
}

function setStatusBadge(status, locale) {
  els.statusBadge.className = "statusBadge";
  if (status === "DONE") {
    els.statusBadge.classList.add("isDone");
    els.statusBadge.textContent = t(locale, "statusDone");
    return;
  }
  if (status === "EMERGENCY") {
    els.statusBadge.classList.add("isEmergency");
    els.statusBadge.textContent = t(locale, "statusEmergency");
    return;
  }
  els.statusBadge.classList.add("isPending");
  els.statusBadge.textContent = t(locale, "statusPending");
}

function isValidProblemNumberInput() {
  const raw = String(els.inputProblemNumber.value || "").trim();
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0;
}

function setChangePanelOpen(opened) {
  changePanelOpen = Boolean(opened);
  els.changePanel.classList.toggle("isCollapsed", !changePanelOpen);
  els.btnChangeToggle.setAttribute("aria-expanded", changePanelOpen ? "true" : "false");
  els.changeCaret.textContent = changePanelOpen ? "▼" : "▶";
}

function setChangeMode(mode) {
  changeMode = mode === "number" ? "number" : "random";
  const isNumber = changeMode === "number";
  els.btnReroll.classList.toggle("isActive", !isNumber);
  els.btnEnterMode.classList.toggle("isActive", isNumber);
  els.numberEntryRow.hidden = !isNumber;
  els.numberEntryRow.classList.toggle("isHidden", !isNumber);
  if (!isNumber) {
    els.inputProblemNumber.value = "";
  }
}

function applyStaticText(locale, used, limit) {
  els.txtTitle.textContent = t(locale, "title");
  els.txtTodayLabel.textContent = t(locale, "todayLabel");
  els.btnOpenToday.textContent = t(locale, "openProblem");
  els.txtCheckCompletion.textContent = t(locale, "checkCompletion");
  els.txtChangeHeader.textContent = `${t(locale, "changeHeader")} (${used} / ${limit})`;
  els.btnReroll.textContent = t(locale, "randomPick");
  els.btnEnterMode.textContent = t(locale, "enterNumber");
  els.inputProblemNumber.placeholder = t(locale, "numberHint");
  els.btnSetNumber.textContent = t(locale, "apply");
  els.txtStreak.textContent = t(locale, "streak");
  els.txtTotal.textContent = t(locale, "total");
  els.txtRate.textContent = t(locale, "rate");
  if (!els.btnOptions.getAttribute("aria-label")) {
    els.btnOptions.setAttribute("aria-label", t(locale, "settings"));
  }
}

function renderEmergencyButton(snapshot, locale) {
  const { emergencyActive, emergencyCanActivate, emergencyRemainingMs } = snapshot;
  els.btnEmergencyToggle.className = "emergencyTextBtn";
  els.btnEmergencyToggle.textContent = t(locale, "emergency");
  if (emergencyActive) {
    els.btnEmergencyToggle.classList.add("isActive");
    els.btnEmergencyToggle.disabled = false;
    els.btnEmergencyToggle.textContent = `${t(locale, "emergency")} ${formatRemainingMs(emergencyRemainingMs)}`;
    return;
  }
  if (!emergencyCanActivate) {
    els.btnEmergencyToggle.classList.add("isLocked");
    els.btnEmergencyToggle.disabled = true;
    return;
  }
  els.btnEmergencyToggle.disabled = false;
}

function render(snapshot) {
  latestSnapshot = snapshot;
  const locale = snapshot?.settings?.uiLanguage === "ko" ? "ko" : "en";
  applyTheme(snapshot?.settings?.theme);

  const { settings, daily, status, problemUrl, problemTitle, problemLevel, rerollRemaining, stats } = snapshot;
  const rerollLimit = Number(settings.rerollLimitPerDay || 0);
  const changeUsed = Math.max(0, Number(daily.rerollUsed || 0));
  const shownUsed = rerollLimit > 0 ? Math.min(rerollLimit, changeUsed) : changeUsed;
  applyStaticText(locale, shownUsed, rerollLimit);
  setStatusBadge(status, locale);

  if (daily.todayProblemId) {
    els.problemLink.textContent = `#${daily.todayProblemId}`;
    els.problemLink.href = problemUrl;
    els.problemTitle.textContent = problemTitle || "";
  } else {
    els.problemLink.textContent = "#-";
    els.problemLink.href = "#";
    els.problemTitle.textContent = t(locale, "noProblem");
  }

  els.tierBadge.src = getTierBadgePath(problemLevel);
  els.tierBadge.hidden = Number(problemLevel || 0) <= 0;

  const missingHandle = !settings.handle;
  els.nicknameBanner.hidden = !missingHandle;
  els.nicknameBanner.textContent = t(locale, "bannerMissingHandle");

  const canChangeTodayProblem = rerollRemaining > 0 && Boolean(settings.handle);
  const isNumberMode = changeMode === "number";
  const canApplyNumber = canChangeTodayProblem && isNumberMode && isValidProblemNumberInput() && !recheckLoading;

  els.btnReroll.disabled = !canChangeTodayProblem || recheckLoading;
  els.btnEnterMode.disabled = !canChangeTodayProblem || recheckLoading;
  els.inputProblemNumber.disabled = !canChangeTodayProblem || !isNumberMode || recheckLoading;
  els.btnSetNumber.disabled = !canApplyNumber;
  els.btnRecheck.disabled = recheckLoading || !daily.todayProblemId;
  els.btnOpenToday.disabled = !daily.todayProblemId;
  els.btnRecheck.classList.toggle("isLoading", recheckLoading);

  renderEmergencyButton(snapshot, locale);

  els.statStreak.textContent = String(stats.streak);
  els.statTotal.textContent = String(stats.totalDone);
  els.statRate.textContent = `${stats.recent30Rate}%`;
  els.lastCheckText.textContent = `${t(locale, "lastCheck")}: ${formatLastCheckTime(daily.lastSolvedCheckAt)}`;
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

els.btnChangeToggle.addEventListener("click", () => {
  setChangePanelOpen(!changePanelOpen);
});

els.btnChangeHelp.addEventListener("click", () => {
  const locale = latestSnapshot?.settings?.uiLanguage === "ko" ? "ko" : "en";
  window.alert(t(locale, "changeHelpText"));
});

els.btnReroll.addEventListener("click", async () => {
  setChangeMode("random");
  setChangePanelOpen(true);
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

els.btnEnterMode.addEventListener("click", () => {
  setChangeMode("number");
  setChangePanelOpen(true);
  if (!latestSnapshot) return;
  render(latestSnapshot);
});

els.inputProblemNumber.addEventListener("input", () => {
  if (!latestSnapshot) return;
  render(latestSnapshot);
});

els.inputProblemNumber.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (els.btnSetNumber.disabled) return;
  els.btnSetNumber.click();
});

els.btnSetNumber.addEventListener("click", async () => {
  const raw = String(els.inputProblemNumber.value || "").trim();
  if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
    if (!latestSnapshot) return;
    const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
    els.errorText.textContent = localizeError(locale, "invalid_problem_id");
    return;
  }
  try {
    const res = await send("CHANGE_TODAY_PROBLEM_BY_NUMBER", { problemId: raw });
    if (!res?.ok) throw new Error(res?.error || "change_problem_failed");
    setChangeMode("random");
    setChangePanelOpen(false);
    render(res.snapshot);
  } catch (err) {
    if (!latestSnapshot) return;
    const locale = latestSnapshot.settings.uiLanguage === "ko" ? "ko" : "en";
    els.errorText.textContent = localizeError(locale, String(err?.message || err));
  }
});

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

setChangeMode("random");
setChangePanelOpen(true);
refresh(true).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});

window.addEventListener("pagehide", notifyPopupClosed);
window.addEventListener("unload", notifyPopupClosed);
