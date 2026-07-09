#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_INPUT = path.join(ROOT, "samples", "pitchcheck", "real-player-story-bank-60.json");
const DEFAULT_REPORT = path.join(ROOT, "assets", "reference", "web", "real-player-story-images.json");
const DEFAULT_MARKDOWN = path.join(ROOT, "assets", "reference", "web", "real-player-story-image-ledger.md");
const DEFAULT_DOWNLOAD_DIR = path.join(ROOT, "assets", "reference", "web", "real-player-story-bank");
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const DYNAMIC_POSITIVE = [
  "football",
  "soccer",
  "association football",
  "player",
  "match",
  "goal",
  "goalkeeper",
  "referee",
  "stadium",
  "kick",
  "corner",
  "penalty",
  "offside",
  "throw",
  "world cup",
  "champions league",
  "premier league",
  "team",
  "fans",
  "celebration",
  "contract",
  "transfer",
  "captain",
  "huddle",
  "crowd",
  "training",
  "var",
];

const VISUAL_NEGATIVE = [
  "logo",
  "icon",
  "emblem",
  "badge",
  "flag",
  "map",
  "diagram",
  "kit",
  "jersey",
  "shirt",
  "poster",
  "trophy",
  "svg",
  "djvu",
  "symbol",
  "table",
  "chart",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: DEFAULT_INPUT,
    download: false,
    force: false,
    resume: false,
    limit: Infinity,
    perQuery: 8,
    queriesPerTopic: 3,
    downloadCount: 3,
    delayMs: 900,
    retries: 3,
    retryBaseMs: 8000,
    localFallback: true,
    reportPath: DEFAULT_REPORT,
    markdownPath: DEFAULT_MARKDOWN,
    downloadDir: DEFAULT_DOWNLOAD_DIR,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--download") {
      opts.download = true;
    } else if (arg === "--force") {
      opts.force = true;
    } else if (arg === "--resume") {
      opts.resume = true;
    } else if (arg === "--limit") {
      opts.limit = Number(args[++i]);
    } else if (arg === "--per-query") {
      opts.perQuery = Number(args[++i]);
    } else if (arg === "--queries-per-topic") {
      opts.queriesPerTopic = Number(args[++i]);
    } else if (arg === "--download-count") {
      opts.downloadCount = Number(args[++i]);
    } else if (arg === "--delay-ms") {
      opts.delayMs = Number(args[++i]);
    } else if (arg === "--retries") {
      opts.retries = Number(args[++i]);
    } else if (arg === "--retry-base-ms") {
      opts.retryBaseMs = Number(args[++i]);
    } else if (arg === "--no-local-fallback") {
      opts.localFallback = false;
    } else if (arg === "--report") {
      opts.reportPath = path.resolve(ROOT, args[++i]);
    } else if (arg === "--markdown") {
      opts.markdownPath = path.resolve(ROOT, args[++i]);
    } else if (arg === "--download-dir") {
      opts.downloadDir = path.resolve(ROOT, args[++i]);
    } else if (!arg.startsWith("--")) {
      opts.input = path.resolve(ROOT, arg);
    }
  }

  return opts;
}

function ensureDir(fileOrDir, isFile = false) {
  const dir = isFile ? path.dirname(fileOrDir) : fileOrDir;
  mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metaValue(extmetadata, key) {
  return stripHtml(extmetadata?.[key]?.value ?? "");
}

function safeSlug(value, fallback = "asset") {
  const slug = String(value)
    .toLowerCase()
    .replace(/^file:/, "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

function pageUrl(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function extForCandidate(candidate) {
  if (candidate.mime === "image/jpeg") return ".jpg";
  if (candidate.mime === "image/png") return ".png";
  if (candidate.mime === "image/webp") return ".webp";
  if (candidate.mime === "image/gif") return ".gif";
  if (candidate.mime === "image/svg+xml") return ".svg";

  try {
    const pathname = new URL(candidate.url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext || ".jpg";
  } catch {
    return ".jpg";
  }
}

function isAllowedImage(candidate) {
  return ALLOWED_IMAGE_MIMES.has(candidate.mime);
}

function walkImages(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkImages(full));
    } else if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function localFallbackPool() {
  const roots = [
    path.join(ROOT, "assets", "images"),
    path.join(ROOT, "assets", "reference", "pitchcheck-local", "chuk9-card-refs"),
    path.join(ROOT, "assets", "reference", "pitchcheck-local", "chuk9-zip-extracted"),
  ];
  const blocked = ["dog", "puppy", "cat", "pet", "animal", "brand", "logo", "pitchcheck-video", "pitchcheck-screens"];
  return roots
    .flatMap(walkImages)
    .filter((file) => {
      const lower = file.toLowerCase();
      return statSync(file).size > 20_000 && !blocked.some((word) => lower.includes(word));
    })
    .sort();
}

function stableIndex(value, length) {
  if (!length) return 0;
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function mimeFromPath(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function localFallbackCandidate(topic, pool) {
  if (!pool.length) return null;
  const file = pool[stableIndex(`${topic.id}-${topic.category}-${topic.hook}`, pool.length)];
  return {
    query: "local fallback football reference",
    topicId: topic.id,
    title: path.basename(file),
    url: "",
    mime: mimeFromPath(file),
    width: 0,
    height: 0,
    size: statSync(file).size,
    description: topic.visualNeed,
    credit: "Local football reference / verify usage rights before final posting",
    artist: "",
    license: "local candidate",
    licenseUrl: "",
    categories: "local football reference",
    sourcePage: "",
    localPath: path.relative(ROOT, file).replace(/\\/g, "/"),
    origin: "local-fallback",
    score: 20,
  };
}

function keywordScore(text, words, weight) {
  const haystack = text.toLowerCase();
  return words.reduce((score, word) => (haystack.includes(word) ? score + weight : score), 0);
}

function scoreCandidate(candidate, topic, query) {
  const text = [
    candidate.title,
    candidate.description,
    candidate.credit,
    candidate.categories,
    topic.hook,
    topic.visualNeed,
    ...(topic.assetSearch?.mustHave ?? []),
    query,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (candidate.mime === "image/jpeg") score += 35;
  if (candidate.mime === "image/png") score += 18;
  if (candidate.mime === "image/webp") score += 18;
  if (candidate.mime === "image/gif") score += 8;
  if (candidate.mime === "image/svg+xml") score -= 35;

  if (candidate.width >= 1600 && candidate.height >= 900) score += 24;
  else if (candidate.width >= 1000 && candidate.height >= 700) score += 16;
  else if (candidate.width >= 700 && candidate.height >= 500) score += 8;
  else score -= 18;

  const ratio = candidate.width && candidate.height ? candidate.width / candidate.height : 1;
  if (ratio >= 0.6 && ratio <= 2.2) score += 8;
  if (ratio < 0.45 || ratio > 3) score -= 12;

  score += keywordScore(text, DYNAMIC_POSITIVE, 5);
  score -= keywordScore(text, VISUAL_NEGATIVE, 12);

  for (const token of query.toLowerCase().split(/\s+/).filter((part) => part.length > 3)) {
    if (text.includes(token)) score += 3;
  }

  if (/flickr|wikimedia|commons/.test(candidate.sourcePage)) score += 2;
  if (/own work|photo|photograph|jpg|jpeg/.test(text)) score += 4;
  if (/logo|svg|diagram|map|flag/.test(candidate.title.toLowerCase())) score -= 30;
  for (const word of topic.assetSearch?.mustHave ?? []) {
    if (word.length > 2 && text.includes(word.toLowerCase())) score += 5;
  }
  for (const word of topic.assetSearch?.avoid ?? []) {
    if (word.length > 2 && text.includes(word.toLowerCase())) score -= 16;
  }

  return score;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "PitchCheckCardNewsAutomation/0.1 (local editorial research)",
        "Api-User-Agent": "PitchCheckCardNewsAutomation/0.1 (local editorial research)",
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, opts) {
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    const response = await fetchWithTimeout(url);
    if (response.ok) return response.json();

    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === opts.retries) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const waitMs = retryAfter > 0 ? retryAfter * 1000 : opts.retryBaseMs * (attempt + 1);
    console.log(`    retry ${attempt + 1}/${opts.retries} after HTTP ${response.status}; waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
  throw new Error("fetch retry loop ended unexpectedly");
}

function candidateFromPage(page, query, topic) {
  const imageinfo = page.imageinfo?.[0];
  if (!imageinfo?.url || !ALLOWED_IMAGE_MIMES.has(String(imageinfo.mime ?? ""))) return null;

  const extmetadata = imageinfo.extmetadata ?? {};
  const candidate = {
    query,
    topicId: topic.id,
    title: page.title,
    url: imageinfo.url,
    mime: imageinfo.mime,
    width: imageinfo.width ?? 0,
    height: imageinfo.height ?? 0,
    size: imageinfo.size ?? 0,
    description: metaValue(extmetadata, "ImageDescription"),
    credit: metaValue(extmetadata, "Credit"),
    artist: metaValue(extmetadata, "Artist"),
    license: metaValue(extmetadata, "LicenseShortName") || metaValue(extmetadata, "UsageTerms"),
    licenseUrl: metaValue(extmetadata, "LicenseUrl"),
    categories: metaValue(extmetadata, "Categories"),
    sourcePage: metaValue(extmetadata, "Descriptionshorturl") || pageUrl(page.title),
  };

  candidate.score = scoreCandidate(candidate, topic, query);
  return candidate;
}

async function searchCommons(query, topic, opts) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(opts.perQuery),
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    format: "json",
    redirects: "1",
  });

  const json = await fetchJson(`${COMMONS_API}?${params.toString()}`, opts);
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.map((page) => candidateFromPage(page, query, topic)).filter(Boolean);
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const key = candidate.url || candidate.title;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique.sort((a, b) => b.score - a.score).slice(0, 8);
}

function buildQueries(topic, opts) {
  const queries = [...(topic.assetSearch?.queries ?? []), ...(topic.imageQueries ?? [])];
  if (topic.category?.includes("law")) queries.push(`association football ${topic.category} referee`);
  if (topic.category?.includes("worldcup")) queries.push("FIFA World Cup football match");
  if (topic.category?.includes("champions")) queries.push("UEFA Champions League football match");
  if (topic.category?.includes("premier")) queries.push("Premier League football match");
  if (topic.pillar === "legend_backstory") queries.push(`${topic.hook} football backstory`);
  if (topic.pillar === "ranking_comparison") queries.push(`${topic.hook} football ranking`);
  if (topic.pillar === "fandom_engagement") queries.push("amateur football team huddle fans");

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, opts.queriesPerTopic);
}

async function downloadCandidate(candidate, topic, opts) {
  ensureDir(opts.downloadDir);
  const ext = extForCandidate(candidate);
  const filename = `${topic.id}-${safeSlug(candidate.title)}${ext}`;
  const target = path.join(opts.downloadDir, filename);
  if (existsSync(target) && !opts.force) {
    return { path: path.relative(ROOT, target).replace(/\\/g, "/"), skipped: true };
  }

  let response = null;
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    response = await fetchWithTimeout(candidate.url, {}, 30000);
    if (response.ok) break;

    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === opts.retries) {
      throw new Error(`download HTTP ${response.status}`);
    }

    const waitMs = retryAfter > 0 ? retryAfter * 1000 : opts.retryBaseMs * (attempt + 1);
    console.log(`    download retry ${attempt + 1}/${opts.retries} after HTTP ${response.status}; waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
  if (!response?.ok) throw new Error("download failed");

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download too large: ${contentLength} bytes`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download too large: ${buffer.byteLength} bytes`);
  }

  writeFileSync(target, buffer);
  return { path: path.relative(ROOT, target).replace(/\\/g, "/"), skipped: false };
}

function sourceUrls(topic, bank) {
  return (topic.sourceRefs ?? []).map((ref) => ({ ref, url: bank.sourceRefs?.[ref] })).filter((item) => item.url);
}

function buildReport(opts, results) {
  return {
    generatedAt: new Date().toISOString(),
    input: path.relative(ROOT, opts.input).replace(/\\/g, "/"),
    licenseNote:
      "Commons candidates are search/download candidates only. Keep sourcePage, artist, and license metadata with final posts.",
    totals: {
      topics: results.length,
      withSelected: results.filter((item) => item.selected).length,
      withLocalPath: results.filter((item) => item.selected?.localPath && !item.selected.downloadError).length,
      webDownloaded: results.filter(
        (item) => item.selected?.localPath && !item.selected.downloadError && item.selected.origin !== "local-fallback",
      ).length,
      localFallback: results.filter((item) => item.selected?.origin === "local-fallback").length,
      downloaded: results.filter((item) => item.selected?.localPath && !item.selected.downloadError).length,
      needsManualSearch: results.filter((item) => !item.selected || item.selected.downloadError).length,
    },
    topics: results,
  };
}

function writeReport(opts, report) {
  ensureDir(opts.reportPath, true);
  ensureDir(opts.markdownPath, true);
  writeFileSync(opts.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(opts.markdownPath, markdownForReport(report), "utf8");
}

function existingReportByTopic(opts) {
  if (!opts.resume || !existsSync(opts.reportPath)) return new Map();
  try {
    const report = readJson(opts.reportPath);
    return new Map((report.topics ?? []).map((topic) => [topic.id, topic]));
  } catch {
    return new Map();
  }
}

function markdownForReport(report) {
  const lines = [
    "# PitchCheck Football Fun Story Bank Image Ledger",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Topics: ${report.totals.topics}`,
    `With image candidates: ${report.totals.withSelected}`,
    `Downloaded: ${report.totals.downloaded}`,
    `Needs manual search: ${report.totals.needsManualSearch}`,
    "",
    "## How To Read",
    "",
    "- `selected.localPath` is the downloaded Commons candidate when `--download` was used.",
    "- `license`, `artist`, and `sourcePage` must be kept for posting credits.",
    "- Low-score or empty rows should be replaced with official/source-owned media before final publishing.",
    "",
    "## Topics",
    "",
  ];

  for (const item of report.topics) {
    lines.push(`### ${item.index}. ${item.hook}`);
    lines.push("");
    lines.push(`- ID: \`${item.id}\``);
    lines.push(`- Category: \`${item.category}\``);
    lines.push(`- Fact: ${item.fact}`);
    lines.push(`- Visual need: ${item.visualNeed}`);
    lines.push(`- Queries: ${item.queries.map((query) => `\`${query}\``).join(", ") || "none"}`);
    if (item.selected) {
      lines.push(`- Selected: ${item.selected.title} (score ${item.selected.score})`);
      lines.push(`- Local: ${item.selected.localPath ? `\`${item.selected.localPath}\`` : "not downloaded"}`);
      lines.push(`- License: ${item.selected.license || "unknown"} / ${item.selected.artist || "unknown artist"}`);
      lines.push(`- Source page: ${item.selected.sourcePage}`);
      if (item.selectedAlternates?.length) {
        lines.push("- Alternates:");
        for (const alt of item.selectedAlternates) {
          lines.push(`  - ${alt.title} (score ${alt.score}) · \`${alt.localPath || "not downloaded"}\``);
        }
      }
    } else {
      lines.push("- Selected: manual search needed");
    }
    lines.push(`- Fact sources: ${item.sources.map((source) => `[${source.ref}](${source.url})`).join(", ")}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const opts = parseArgs();
  const bank = readJson(opts.input);
  const topics = bank.topics.slice(0, opts.limit);
  const resumeMap = existingReportByTopic(opts);
  const resultsById = new Map(resumeMap);
  const fallbackPool = opts.localFallback ? localFallbackPool() : [];
  const orderedResults = () => topics.map((topic) => resultsById.get(topic.id)).filter(Boolean);

  console.log(`Story bank: ${path.relative(ROOT, opts.input)}`);
  console.log(`Topics: ${topics.length}`);
  console.log(`Download: ${opts.download ? "yes" : "no"}`);

  for (const [index, topic] of topics.entries()) {
    const existing = resumeMap.get(topic.id);
    if (
      existing?.selected?.localPath &&
      isAllowedImage(existing.selected) &&
      existsSync(path.join(ROOT, existing.selected.localPath)) &&
      !opts.force
    ) {
      console.log(`[${String(index + 1).padStart(2, "0")}/${topics.length}] ${topic.id} ${topic.hook}`);
      console.log(`  - resume: ${existing.selected.localPath}`);
      writeReport(opts, buildReport(opts, orderedResults()));
      continue;
    }

    const queries = buildQueries(topic, opts);
    const found = [];
    const errors = [];
    console.log(`[${String(index + 1).padStart(2, "0")}/${topics.length}] ${topic.id} ${topic.hook}`);

    for (const query of queries) {
      try {
        const candidates = await searchCommons(query, topic, opts);
        found.push(...candidates);
        console.log(`  - ${query}: ${candidates.length}`);
      } catch (error) {
        errors.push({ query, message: error.message });
        console.log(`  - ${query}: ${error.message}`);
      }
      await sleep(opts.delayMs);
    }

    const candidates = uniqueCandidates(found);
    let selected = candidates[0] ? { ...candidates[0] } : null;

    let selectedAlternates = [];
    if (opts.download && candidates.length) {
      const downloadErrors = [];
      const downloaded = [];
      for (const candidate of candidates) {
        if (downloaded.length >= opts.downloadCount) break;
        const candidateCopy = { ...candidate };
        try {
          const download = await downloadCandidate(candidateCopy, topic, opts);
          candidateCopy.localPath = download.path;
          candidateCopy.downloadSkipped = download.skipped;
          downloaded.push(candidateCopy);
        } catch (error) {
          downloadErrors.push({ title: candidate.title, message: error.message });
        }
      }
      if (downloaded.length) {
        selected = downloaded[0];
        selectedAlternates = downloaded.slice(1);
      } else {
        selected = { ...candidates[0], downloadError: downloadErrors.map((item) => `${item.title}: ${item.message}`).join(" | ") };
      }
    }

    if ((!selected || !selected.localPath) && opts.localFallback) {
      const fallback = localFallbackCandidate(topic, fallbackPool);
      if (fallback) {
        selected = fallback;
        console.log(`  - local fallback: ${fallback.localPath}`);
      }
    }

    resultsById.set(topic.id, {
      index: index + 1,
      id: topic.id,
      category: topic.category,
      hook: topic.hook,
      fact: topic.fact,
      whyFun: topic.whyFun,
      pitchCheckBridge: topic.pitchCheckBridge,
      visualNeed: topic.visualNeed,
      motionIdea: topic.motionIdea,
      queries,
      selected,
      selectedAlternates,
      candidates,
      errors,
      sources: sourceUrls(topic, bank),
    });
    writeReport(opts, buildReport(opts, orderedResults()));
  }

  const report = buildReport(opts, orderedResults());
  writeReport(opts, report);

  console.log("");
  console.log(`Report: ${path.relative(ROOT, opts.reportPath)}`);
  console.log(`Ledger: ${path.relative(ROOT, opts.markdownPath)}`);
  if (opts.download) console.log(`Downloads: ${path.relative(ROOT, opts.downloadDir)}`);
  console.log(`Selected ${report.totals.withSelected}/${report.totals.topics}, downloaded ${report.totals.downloaded}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
