import { levelToTierLabel } from "../shared/picker.js";

const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    title: "BOJ Forcer",
    rerollRemaining: "Reroll Remaining",
    reroll: "Reroll",
    recheck: "Re-check",
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
    err_reroll_limit: "Reroll limit reached.",
    err_rate_limited: "Rate limited by solved.ac.",
    err_server_error: "solved.ac server error.",
    err_offline_or_cors: "Network error.",
    err_timeout: "Request timeout.",
    err_emergency_used_today: "Emergency already used today."
  },
  ko: {
    title: "BOJ Forcer",
    rerollRemaining: "남은 리롤",
    reroll: "리롤",
    recheck: "재검사",
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
    err_reroll_limit: "리롤 한도를 초과했습니다.",
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
  const ratio = rerollLimit <= 0 ? 0 : (rerollRemaining / rerollLimit) * 100;
  els.rerollBar.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
  els.rerollCount.textContent = `${rerollRemaining} / ${rerollLimit}`;

  els.btnReroll.disabled = rerollRemaining <= 0 || !daily.todayProblemId || recheckLoading;
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
