const API_BASE = "https://solved.ac/api/v3";
const DEFAULT_TIMEOUT_MS = 10000;
const BOJ_STATUS_URL = "https://www.acmicpc.net/status";
const BOJ_ACCEPTED_RESULT_ID = 4;
const KST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const kstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function normalizeTagKey(rawTag) {
  const tag = String(rawTag || "").trim().toLowerCase();
  if (!tag) return "";
  if (tag === "tree") return "trees";
  return tag;
}

function classifyHttpError(status) {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status === 404) return "not_found";
  return "http_error";
}

export function classifyError(err) {
  if (!err) return "unknown";
  if (err.code) return err.code;
  if (err.name === "AbortError") return "timeout";
  if (String(err.message || "").includes("Failed to fetch")) return "offline_or_cors";
  return "unknown";
}

export async function apiGet(path, params = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      const code = classifyHttpError(res.status);
      throw {
        code,
        status: res.status,
        message: `HTTP ${res.status}`
      };
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/html"
      }
    });
    if (!res.ok) {
      const code = classifyHttpError(res.status);
      throw {
        code,
        status: res.status,
        message: `HTTP ${res.status}`
      };
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchProblem(query, page = 1) {
  return apiGet("/search/problem", { query, page: Number(page) || 1 });
}

function getEnglishTitle(item) {
  const titles = Array.isArray(item?.titles) ? item.titles : [];
  const en = titles.find((t) => t?.language === "en");
  if (en?.title) return String(en.title);
  const first = titles.find((t) => t?.title);
  if (first?.title) return String(first.title);
  return "";
}

export function extractProblemCandidates(searchResponse) {
  const items = Array.isArray(searchResponse?.items) ? searchResponse.items : [];
  return items
    .map((item) => ({
      problemId: Number(item?.problemId || 0),
      level: Number(item?.level || 0),
      titleKo: String(item?.titleKo || ""),
      titleEn: getEnglishTitle(item)
    }))
    .filter((item) => Number.isInteger(item.problemId) && item.problemId > 0);
}

export function extractProblemIds(searchResponse) {
  return extractProblemCandidates(searchResponse).map((item) => item.problemId);
}

export async function checkSolved(handle, problemId) {
  const query = `@${handle} id:${problemId}`;
  const data = await searchProblem(query, 1);
  return Number(data?.count || 0) > 0;
}

function extractLatestAcceptedTimestampSec(statusHtml) {
  const match = String(statusHtml || "").match(/data-timestamp="(\d{9,})"/i);
  if (!match?.[1]) return 0;
  const tsSec = Number(match[1]);
  if (!Number.isFinite(tsSec) || tsSec <= 0) return 0;
  return Math.floor(tsSec);
}

function getKSTDateFromUnixSeconds(tsSec) {
  return kstDateFormatter.format(new Date(tsSec * 1000));
}

export async function checkSolvedToday(handle, problemId, todayDateKST) {
  const normalizedHandle = String(handle || "").trim();
  const normalizedProblemId = Number(problemId);
  if (!normalizedHandle) return false;
  if (!Number.isInteger(normalizedProblemId) || normalizedProblemId <= 0) return false;
  if (!KST_DATE_RE.test(String(todayDateKST || ""))) return false;

  const url = new URL(BOJ_STATUS_URL);
  url.searchParams.set("problem_id", String(normalizedProblemId));
  url.searchParams.set("user_id", normalizedHandle);
  url.searchParams.set("result_id", String(BOJ_ACCEPTED_RESULT_ID));

  const statusHtml = await fetchText(url.toString());
  const latestAcceptedTsSec = extractLatestAcceptedTimestampSec(statusHtml);
  if (!latestAcceptedTsSec) return false;

  return getKSTDateFromUnixSeconds(latestAcceptedTsSec) === todayDateKST;
}

export async function checkHandle(handle) {
  return apiGet("/user/show", { handle });
}

export async function getProblemById(problemId) {
  return apiGet("/problem/show", { problemId: Number(problemId) || 0 });
}

function getTagDisplayName(displayNames, language) {
  const list = Array.isArray(displayNames) ? displayNames : [];
  const matched = list.find((row) => row?.language === language && row?.name);
  if (matched?.name) return String(matched.name);
  return "";
}

export function extractTagChoices(tagListResponse) {
  const items = Array.isArray(tagListResponse?.items) ? tagListResponse.items : [];
  const out = [];
  const seen = new Set();

  for (const item of items) {
    const id = normalizeTagKey(item?.key);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const enName = getTagDisplayName(item?.displayNames, "en");
    const koName = getTagDisplayName(item?.displayNames, "ko");

    out.push({
      id,
      en: enName || koName || id,
      ko: koName || enName || id,
      problemCount: Number(item?.problemCount || 0)
    });
  }

  out.sort((a, b) => {
    if (b.problemCount !== a.problemCount) return b.problemCount - a.problemCount;
    return a.en.localeCompare(b.en);
  });

  return out.map(({ problemCount, ...choice }) => choice);
}

export async function getTagChoices() {
  const response = await apiGet("/tag/list");
  return extractTagChoices(response);
}
