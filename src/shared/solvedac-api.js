const API_BASE = "https://solved.ac/api/v3";
const DEFAULT_TIMEOUT_MS = 10000;

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

export async function checkHandle(handle) {
  return apiGet("/user/show", { handle });
}

export async function getProblemById(problemId) {
  return apiGet("/problem/show", { problemId: Number(problemId) || 0 });
}
