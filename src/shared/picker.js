const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ruby"];
const TIER_ROMAN = ["V", "IV", "III", "II", "I"];

function normalizeTagKey(rawTag) {
  const tag = String(rawTag || "").trim().toLowerCase();
  if (!tag) return "";
  if (tag === "tree") return "trees";
  return tag;
}

function tierNameByLevel(level) {
  const n = Math.max(1, Math.min(30, Number(level) || 1));
  const tierIndex = Math.floor((n - 1) / 5);
  const subIndex = (n - 1) % 5;
  return `${TIER_NAMES[tierIndex]} ${TIER_ROMAN[subIndex]}`;
}

export function buildTierOptions() {
  const out = [];
  for (let i = 1; i <= 30; i += 1) {
    out.push({ value: i, label: tierNameByLevel(i) });
  }
  return out;
}

export function levelToTierLabel(level) {
  return tierNameByLevel(level);
}

export function normalizeTagList(input) {
  const seen = new Set();
  const out = [];
  for (const raw of String(input || "").split(/\s|,|\n/)) {
    const tag = normalizeTagKey(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function cleanLangs(languages) {
  const langs = Array.isArray(languages) ? languages : [];
  const valid = langs.filter((lang) => lang === "ko" || lang === "en");
  return valid.length ? valid : ["ko", "en"];
}

export function buildProblemQuery(settings) {
  const handle = String(settings?.handle || "").trim();
  const filters = settings?.filters || {};
  const levelMin = Math.max(1, Math.min(30, Number(filters.levelMin) || 1));
  const levelMax = Math.max(levelMin, Math.min(30, Number(filters.levelMax) || 30));
  const languages = cleanLangs(filters.languages);
  const includeTags = Array.isArray(filters.includeTags) ? filters.includeTags : [];
  const excludeTags = Array.isArray(filters.excludeTags) ? filters.excludeTags : [];

  const tokens = [];
  tokens.push(`*${levelMin}..${levelMax}`);
  if (handle) tokens.push(`!@${handle}`);
  if (filters.requireSolvable) tokens.push("o?true");
  if (filters.excludeWarnings) tokens.push("w?false");
  if (languages.length === 1) {
    tokens.push(`%${languages[0]}`);
  } else if (languages.length >= 2) {
    tokens.push(`(${languages.map((v) => `%${v}`).join(" | ")})`);
  }

  const minSolvedCount = Number(filters.minSolvedCount || 0);
  if (minSolvedCount > 0) tokens.push(`s#${Math.floor(minSolvedCount)}..`);

  for (const tag of includeTags) {
    const t = normalizeTagKey(tag);
    if (!t) continue;
    tokens.push(`#${t}`);
  }
  for (const tag of excludeTags) {
    const t = normalizeTagKey(tag);
    if (!t) continue;
    tokens.push(`!#${t}`);
  }

  return tokens.join(" ").trim();
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export function pickDeterministicProblemId(candidates, dateKST, rerollUsed = 0, autoAdvanceUsed = 0) {
  const list = Array.from(new Set((Array.isArray(candidates) ? candidates : []).map((v) => Number(v))))
    .filter((v) => Number.isInteger(v) && v > 0)
    .sort((a, b) => a - b);
  if (!list.length) return 0;
  const seed = `${dateKST}:${rerollUsed}:${autoAdvanceUsed}`;
  const idx = hashString(seed) % list.length;
  return list[idx];
}

export function getTodayProblemUrl(problemId) {
  return `https://www.acmicpc.net/problem/${problemId}`;
}

export function isTodayProblemUrl(url, problemId) {
  if (!url || !problemId) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "www.acmicpc.net") return false;
    return u.pathname === `/problem/${problemId}`;
  } catch {
    return false;
  }
}
