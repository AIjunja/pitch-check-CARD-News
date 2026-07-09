#!/usr/bin/env node

import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const BLOCKED_IDS = new Set([
  "pitchcheck-video-003",
  "pitchcheck-video-015",
  "pitchcheck-video-016",
  "video-003",
  "video-015",
  "video-016",
]);

const BLOCKED_TEXT = [
  "dog",
  "puppy",
  "cat",
  "animal",
  "skateboard",
  "pet",
  "\uac15\uc544\uc9c0",
  "\ubc18\ub824",
  "\uace0\uc591\uc774",
];

const REQUIREMENT_PRESETS = {
  hook: {
    visualJob: "stop-scroll football story hook",
    requiredAsset:
      "A recognizable football moment, player/coach face, match reaction, or strong archive-style full-bleed image.",
    preferredTypes: ["topic-story", "football-reference", "repo-football-story"],
    preferredMediaTypes: ["image"],
    positiveKeywords: ["cover", "football", "chelsea", "player", "match", "archive", "team", "coach"],
    negativeKeywords: ["dashboard", "pitchcheck-video", "screen", "ui", "gps"],
    localSearchTerms: ["cover", "football", "match", "player", "coach"],
    webSearchTerms: ["football story cover image", "match reaction photo", "training ground photo"],
  },
  proof: {
    visualJob: "source proof or rule evidence",
    requiredAsset:
      "A proof-like visual: fine table, rule list, training discipline reference, document crop, or source screenshot.",
    preferredTypes: ["topic-story", "football-reference", "repo-football-story"],
    preferredMediaTypes: ["image"],
    positiveKeywords: ["detail_01", "fine", "table", "rule", "discipline", "proof", "list", "training"],
    negativeKeywords: ["dashboard", "pitchcheck-video", "screen", "gps"],
    localSearchTerms: ["fine", "table", "rule", "discipline", "detail_01"],
    webSearchTerms: ["fines list image", "football club rules list", "training discipline source"],
  },
  meaning: {
    visualJob: "team culture and discipline interpretation",
    requiredAsset:
      "A coach, training, team huddle, dressing-room, or disciplined team-management image that explains the story meaning.",
    preferredTypes: ["topic-story", "football-reference", "repo-football-story"],
    preferredMediaTypes: ["image"],
    positiveKeywords: ["detail_02", "discipline", "coach", "manager", "training", "team", "huddle"],
    negativeKeywords: ["dashboard", "pitchcheck-video", "screen", "gps"],
    localSearchTerms: ["coach", "training", "discipline", "team", "detail_02"],
    webSearchTerms: ["football training discipline photo", "coach team talk image", "team huddle photo"],
  },
  empathy: {
    visualJob: "amateur team operator pain",
    requiredAsset:
      "A group chat, attendance check, team message, amateur football team, captain/manager checking phone, or schedule confusion visual.",
    preferredTypes: ["topic-story", "football-reference", "repo-football-story", "product-screen"],
    preferredMediaTypes: ["image", "screenshot"],
    positiveKeywords: ["detail_03", "chat", "kakao", "message", "group", "team", "phone", "attendance"],
    negativeKeywords: ["dog", "pet"],
    localSearchTerms: ["chat", "message", "group", "team", "phone", "detail_03"],
    webSearchTerms: ["amateur football team group chat", "football team attendance message", "captain checking phone"],
  },
  pain: {
    visualJob: "bridge from pain to product",
    requiredAsset:
      "A product-adjacent visual showing repeated checking: dashboard, attendance, schedule, GPS, calendar, or team-management UI.",
    preferredTypes: ["product-screen", "product-frame", "repo-shared-product", "topic-story"],
    preferredMediaTypes: ["screenshot", "video-frame", "image"],
    positiveKeywords: ["dashboard", "attendance", "schedule", "gps", "location", "calendar", "check", "pitchcheck"],
    negativeKeywords: ["dog", "pet"],
    localSearchTerms: ["dashboard", "attendance", "schedule", "location", "gps"],
    webSearchTerms: ["team attendance app screenshot", "football team management app UI", "schedule check app screen"],
  },
  pitchcheck: {
    visualJob: "PitchCheck product proof",
    requiredAsset:
      "Real PitchCheck app screens or usage-video frames that show team creation, attendance, schedule, location, or check-in.",
    preferredTypes: ["product-frame", "product-screen", "repo-shared-product"],
    preferredMediaTypes: ["video-frame", "screenshot", "image"],
    positiveKeywords: ["pitchcheck", "frame", "team", "match", "attendance", "schedule", "location", "gps"],
    negativeKeywords: ["dog", "pet"],
    localSearchTerms: ["pitchcheck", "frame", "attendance", "schedule", "location"],
    webSearchTerms: ["PitchCheck app screenshot", "PitchCheck football team app", "attendance schedule location app"],
  },
  cta: {
    visualJob: "installation CTA proof mosaic",
    requiredAsset:
      "A high-density mix of PitchCheck screenshots, app frames, promo screenshots, and install-proof UI tiles.",
    preferredTypes: ["product-screen", "product-frame", "repo-shared-product"],
    preferredMediaTypes: ["screenshot", "video-frame", "image"],
    positiveKeywords: ["pitchcheck", "screen", "frame", "app", "promo", "install", "dashboard"],
    negativeKeywords: ["dog", "pet"],
    localSearchTerms: ["pitchcheck", "screen", "app", "promo", "dashboard"],
    webSearchTerms: ["PitchCheck app install screenshot", "PitchCheck app promo image", "football team app CTA"],
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const topicPath = positional[0] || "samples/pitchcheck/lampard-fines-real-cta.json";
  const manifestIndex = args.indexOf("--manifest");
  const reportIndex = args.indexOf("--report");
  const ledgerIndex = args.indexOf("--ledger");

  return {
    topicPath: path.resolve(ROOT, topicPath),
    manifestPath:
      manifestIndex >= 0
        ? path.resolve(ROOT, args[manifestIndex + 1])
        : path.join(ROOT, "assets", "reference", "pitchcheck-local", "media-manifest.json"),
    reportPath:
      reportIndex >= 0
        ? path.resolve(ROOT, args[reportIndex + 1])
        : path.join(ROOT, "assets", "reference", "pitchcheck-local", "story-asset-plan.json"),
    ledgerPath:
      ledgerIndex >= 0
        ? path.resolve(ROOT, args[ledgerIndex + 1])
        : path.join(ROOT, "assets", "reference", "pitchcheck-local", "story-asset-ledger.md"),
    write: args.includes("--write"),
    refreshMedia: args.includes("--refresh-media"),
    includeProductCards: !args.includes("--story-only"),
    minConfidence: Number(args.find((arg) => arg.startsWith("--min-confidence="))?.split("=")[1] || 35),
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function repoPath(absPath) {
  return path.relative(ROOT, absPath).replaceAll("\\", "/");
}

function pathForTopic(repoRelativePath, topicPath) {
  const absPath = path.resolve(ROOT, repoRelativePath);
  return path.relative(path.dirname(topicPath), absPath).replaceAll("\\", "/");
}

function safeId(value) {
  const base = String(value || "asset");
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const hash = createHash("sha1").update(base).digest("hex").slice(0, 8);
  return `${slug || "asset"}-${hash}`;
}

function toLines(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value == null) return [];
  return [String(value)];
}

function textForCard(card) {
  return [
    card.type,
    card.role,
    card.label,
    ...toLines(card.headline),
    ...toLines(card.body),
    ...(card.accent || []),
    card.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function candidateText(candidate) {
  return [
    candidate.id,
    candidate.type,
    candidate.assetType,
    candidate.mediaType,
    candidate.usage,
    candidate.source,
    candidate.file,
    candidate.repoPath,
    candidate.path,
    candidate.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isBlocked(candidate) {
  if (BLOCKED_IDS.has(candidate.id)) return true;
  const text = candidateText(candidate);
  return BLOCKED_TEXT.some((word) => text.includes(word));
}

function candidateIdFromManifest(item) {
  if (item.type === "pitchcheck-video-frame") return item.id.replace(/^pitchcheck-video-/, "video-");
  if (item.type === "pitchcheck-screen") return item.id.replace(/^pitchcheck-screen-/, "screen-");
  return item.id;
}

function assetTypeForManifest(item) {
  if (item.type === "pitchcheck-video-frame") return "product-frame";
  if (item.type === "pitchcheck-screen") return "product-screen";
  if (item.type === "football-reference") return "football-reference";
  return item.type || "manifest-asset";
}

function mediaTypeForManifest(item) {
  if (item.type === "pitchcheck-video-frame") return "video-frame";
  if (item.type === "pitchcheck-screen") return "screenshot";
  return "image";
}

function scanFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFiles(abs, results);
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(abs);
    }
  }
  return results;
}

function repoImageCandidates() {
  const imageRoot = path.join(ROOT, "assets", "images");
  return scanFiles(imageRoot)
    .filter((filePath) => {
      try {
        return statSync(filePath).size >= 10_000;
      } catch {
        return false;
      }
    })
    .map((filePath) => {
      const rel = repoPath(filePath);
      const sharedAsset = rel.includes("/shared/");
      return {
        id: `repo-${safeId(rel)}`,
        sourceKind: "repo",
        assetType: sharedAsset ? "repo-shared-product" : "repo-football-story",
        mediaType: "image",
        usage: sharedAsset ? "Repository PitchCheck UI reference" : "Repository football story candidate",
        file: filePath,
        repoPath: rel,
        source: rel,
      };
    });
}

function topicMediaCandidates(topic, topicPath) {
  const topicDir = path.dirname(topicPath);
  return (topic.media || []).map((item) => {
    const absPath = item.path ? path.resolve(topicDir, item.path) : null;
    const text = [item.id, item.path, item.url, item.usage, item.credit].filter(Boolean).join(" ").toLowerCase();
    const productLike = /pitchcheck|dashboard|gps|screen|frame|app|ui/.test(text);
    const videoLike = /video|frame/.test(text);
    const screenshotLike = /screen|dashboard|ui|app|gps/.test(text);
    return {
      id: item.id,
      existingMediaId: item.id,
      sourceKind: "topic",
      assetType: productLike ? "product-screen" : "topic-story",
      mediaType: videoLike ? "video-frame" : screenshotLike ? "screenshot" : "image",
      usage: item.usage,
      source: item.credit || item.url || item.path,
      path: item.path,
      url: item.url,
      file: absPath,
      repoPath: absPath && absPath.startsWith(ROOT) ? repoPath(absPath) : item.path,
      mediaObject: item,
    };
  });
}

function manifestCandidates(manifest) {
  return (manifest.items || [])
    .filter((item) => item.file && item.repoPath && existsSync(item.file))
    .map((item) => ({
      id: candidateIdFromManifest(item),
      manifestId: item.id,
      sourceKind: "manifest",
      assetType: assetTypeForManifest(item),
      mediaType: mediaTypeForManifest(item),
      usage: item.usage,
      source: item.source,
      file: item.file,
      repoPath: item.repoPath,
      width: item.width,
      height: item.height,
    }));
}

function dedupeCandidates(candidates) {
  const seen = new Map();
  for (const candidate of candidates) {
    const key = candidate.url || candidate.repoPath || candidate.file || candidate.id;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, candidate);
      continue;
    }
    if (existing.sourceKind !== "topic" && candidate.sourceKind === "topic") {
      seen.set(key, candidate);
    }
  }
  return [...seen.values()].filter((candidate) => !isBlocked(candidate));
}

function requirementKeyForCard(card, index, total) {
  if (card.type === "pitchcheck") return "pitchcheck";
  if (card.type === "cta") return "cta";
  const role = String(card.role || "").toLowerCase();
  if (index === 0 || card.type === "cover" || role.includes("hook")) return "hook";
  if (card.type === "stat" || role.includes("proof")) return "proof";
  if (card.type === "bridge" || role.includes("empathy")) return "empathy";
  if (role.includes("pain") || index === total - 3) return "pain";
  return "meaning";
}

function buildRequirement(topic, card, index, total) {
  const key = requirementKeyForCard(card, index, total);
  const preset = REQUIREMENT_PRESETS[key];
  const seed = [
    topic.project?.title,
    topic.sources?.[0]?.label,
    ...toLines(card.headline),
    card.label,
  ]
    .filter(Boolean)
    .join(" ");
  const sourceQueries = (topic.search || [])
    .map((item) => item.query)
    .filter(Boolean)
    .filter((query) => !/local pitchcheck|per-card visual asset/i.test(query))
    .slice(0, 3);
  const externalQueries = [
    ...sourceQueries.map((query) => `${query} ${preset.webSearchTerms[0]}`),
    ...preset.webSearchTerms.map((term) => `${seed} ${term}`.trim()),
  ]
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    key,
    visualJob: preset.visualJob,
    requiredAsset: preset.requiredAsset,
    preferredTypes: preset.preferredTypes,
    preferredMediaTypes: preset.preferredMediaTypes,
    localSearchTerms: preset.localSearchTerms,
    externalQueries,
    positiveKeywords: preset.positiveKeywords,
    negativeKeywords: preset.negativeKeywords,
  };
}

function keywordScore(text, keywords, weight) {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) score += weight;
  }
  return score;
}

function scoreCandidate(candidate, requirement, card, index, usedIds) {
  const text = candidateText(candidate);
  let score = 0;
  const reasons = [];

  if (candidate.id === card.media) {
    score += 45;
    reasons.push("already assigned to this card");
  }

  if ((card.mediaGallery || []).includes(candidate.id)) {
    score += 35;
    reasons.push("already used in this card gallery");
  }

  if (requirement.preferredTypes.includes(candidate.assetType)) {
    score += 24;
    reasons.push(`preferred asset type: ${candidate.assetType}`);
  }

  if (requirement.preferredMediaTypes.includes(candidate.mediaType)) {
    score += 16;
    reasons.push(`preferred media type: ${candidate.mediaType}`);
  }

  const positiveScore = keywordScore(text, requirement.positiveKeywords, 6);
  if (positiveScore) {
    score += positiveScore;
    reasons.push("matched visual keywords");
  }

  const localScore = keywordScore(text, requirement.localSearchTerms, 4);
  if (localScore) score += localScore;

  const negativeScore = keywordScore(text, requirement.negativeKeywords, -16);
  if (negativeScore) {
    score += negativeScore;
    reasons.push("matched avoid keywords");
  }

  if (candidate.sourceKind === "topic") {
    score += 10;
    reasons.push("already in topic media list");
  }

  if (candidate.assetType === "repo-football-story" && index < 5) score += 4;
  if (candidate.assetType.startsWith("product") && index >= 4) score += 5;
  if (usedIds.has(candidate.id) && candidate.id !== card.media) {
    score -= 18;
    reasons.push("already selected on another card");
  }

  return {
    candidate,
    score,
    reasons,
  };
}

function mediaObjectFromCandidate(candidate, topicPath, usage) {
  if (candidate.mediaObject) {
    return {
      ...candidate.mediaObject,
      usage: candidate.mediaObject.usage || usage,
    };
  }

  if (candidate.url) {
    return {
      id: candidate.id,
      url: candidate.url,
      alt: candidate.usage || candidate.id,
      credit: candidate.source || "Remote media",
      usage,
    };
  }

  return {
    id: candidate.id,
    path: pathForTopic(candidate.repoPath, topicPath),
    alt: candidate.usage || candidate.id,
    credit:
      candidate.assetType === "football-reference" || candidate.assetType === "repo-football-story"
        ? "Football reference"
        : "PitchCheck media",
    usage,
  };
}

function ensureMedia(topic, candidate, topicPath, usage, report) {
  const media = mediaObjectFromCandidate(candidate, topicPath, usage);
  const existing = topic.media.find((entry) => entry.id === media.id);
  if (existing) return existing.id;

  const normalizedPath = (media.path || "").replaceAll("\\", "/");
  if (normalizedPath) {
    const duplicate = topic.media.find((entry) => (entry.path || "").replaceAll("\\", "/") === normalizedPath);
    if (duplicate) return duplicate.id;
  }

  topic.media.push(media);
  report.addedMedia.push(media.id);
  return media.id;
}

function resolveCard(topic, topicPath, card, index, total, candidates, usedIds, options, report) {
  const requirement = buildRequirement(topic, card, index, total);
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, requirement, card, index, usedIds))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const best = ranked[0] || null;
  const status = best && best.score >= options.minConfidence ? "ready" : "needs_external_search";
  const selectedMedia = best
    ? ensureMedia(topic, best.candidate, topicPath, requirement.visualJob, report)
    : null;
  const shouldAssignSingleMedia =
    selectedMedia &&
    card.type !== "pitchcheck" &&
    card.type !== "cta" &&
    (!card.media || options.refreshMedia);
  const previousMedia = card.media || null;
  const previousGallery = Array.isArray(card.mediaGallery) ? [...card.mediaGallery] : null;
  const previousAssignment = previousMedia || previousGallery;

  if (shouldAssignSingleMedia) {
    card.media = selectedMedia;
  }

  const plan = {
    status,
    visualJob: requirement.visualJob,
    requiredAsset: requirement.requiredAsset,
    preferredMediaTypes: requirement.preferredMediaTypes,
    selectedMedia,
    confidence: best ? Math.max(0, Math.min(100, Math.round(best.score))) : 0,
    externalQueries: requirement.externalQueries,
  };
  card.assetPlan = plan;

  if (selectedMedia) usedIds.add(selectedMedia);

  return {
    card: index + 1,
    type: card.type,
    role: card.role || "",
    currentMedia: previousMedia,
    currentGallery: previousGallery,
    selectedMedia,
    assignedMedia: shouldAssignSingleMedia ? selectedMedia : previousAssignment,
    changed: shouldAssignSingleMedia && previousMedia !== selectedMedia,
    status,
    visualJob: requirement.visualJob,
    requiredAsset: requirement.requiredAsset,
    preferredMediaTypes: requirement.preferredMediaTypes,
    confidence: plan.confidence,
    externalQueries: requirement.externalQueries,
    candidates: ranked.map((entry) => ({
      id: entry.candidate.id,
      score: Math.round(entry.score),
      assetType: entry.candidate.assetType,
      mediaType: entry.candidate.mediaType,
      sourceKind: entry.candidate.sourceKind,
      path: entry.candidate.repoPath || entry.candidate.path || entry.candidate.url || "",
      reasons: entry.reasons,
    })),
  };
}

function markdownLedger(topic, report) {
  const lines = [
    "# PitchCheck Story Asset Ledger",
    "",
    `Generated: ${report.generatedAt}`,
    `Topic: ${report.topic}`,
    "",
    "## Candidate Pool",
    "",
    `- topic media: ${report.candidateCounts.topic || 0}`,
    `- manifest media: ${report.candidateCounts.manifest || 0}`,
    `- repository images: ${report.candidateCounts.repo || 0}`,
    "",
    "## Card Requirements",
    "",
  ];

  for (const item of report.cards) {
    lines.push(`### Card ${String(item.card).padStart(2, "0")} - ${item.type}${item.role ? ` / ${item.role}` : ""}`);
    lines.push("");
    lines.push(`- visual job: ${item.visualJob}`);
    lines.push(`- needs: ${item.requiredAsset}`);
    lines.push(`- selected: ${item.selectedMedia || "none"} (${item.confidence}/100, ${item.status})`);
    lines.push(`- assigned media: ${item.assignedMedia || "none"}`);
    if (item.changed) lines.push("- changed: yes");
    lines.push("- top candidates:");
    for (const candidate of item.candidates.slice(0, 5)) {
      lines.push(
        `  - ${candidate.id} | ${candidate.score} | ${candidate.assetType}/${candidate.mediaType} | ${candidate.path}`,
      );
    }
    lines.push("- external search if local candidates are weak:");
    for (const query of item.externalQueries.slice(0, 3)) {
      lines.push(`  - ${query}`);
    }
    lines.push("");
  }

  if (topic.caption) {
    lines.push("## Caption");
    lines.push("");
    lines.push(topic.caption);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function countBySource(candidates) {
  return candidates.reduce((counts, candidate) => {
    counts[candidate.sourceKind] = (counts[candidate.sourceKind] || 0) + 1;
    return counts;
  }, {});
}

function main() {
  const options = parseArgs();
  if (!existsSync(options.topicPath)) throw new Error(`Missing topic JSON: ${options.topicPath}`);

  const topic = readJson(options.topicPath);
  const manifest = existsSync(options.manifestPath) ? readJson(options.manifestPath) : { items: [] };
  topic.media ||= [];
  topic.search ||= [];

  const topicCandidates = topicMediaCandidates(topic, options.topicPath);
  const manifestAssetCandidates = manifestCandidates(manifest);
  const repoCandidates = repoImageCandidates();
  const candidates = dedupeCandidates([...topicCandidates, ...manifestAssetCandidates, ...repoCandidates]);

  const report = {
    generatedAt: new Date().toISOString(),
    topic: repoPath(options.topicPath),
    manifest: existsSync(options.manifestPath) ? repoPath(options.manifestPath) : null,
    addedMedia: [],
    candidateCounts: countBySource(candidates),
    cards: [],
    notes: [
      "Each card is classified into a visual job before candidates are scored.",
      "The script resolves local/topic/repository assets first and leaves external search queries when confidence is weak.",
    ],
  };

  const usedIds = new Set();
  topic.cards.forEach((card, index) => {
    if (!options.includeProductCards && (card.type === "pitchcheck" || card.type === "cta")) return;
    const cardReport = resolveCard(
      topic,
      options.topicPath,
      card,
      index,
      topic.cards.length,
      candidates,
      usedIds,
      options,
      report,
    );
    report.cards.push(cardReport);
  });

  const intent = {
    query: "per-card visual asset requirements and retrieval plan",
    purpose:
      "Classify each story card by visual job, score local/repository candidates, and leave external search queries when local media is weak.",
    preferredSources: [
      "topic media[]",
      "assets/reference/pitchcheck-local/media-manifest.json",
      "assets/images/**/*",
      "official/credible web sources for unresolved cards",
    ],
  };
  if (!topic.search.some((item) => item.query === intent.query)) {
    topic.search.push(intent);
  }

  mkdirSync(path.dirname(options.reportPath), { recursive: true });
  writeJson(options.reportPath, report);
  mkdirSync(path.dirname(options.ledgerPath), { recursive: true });
  writeFileSync(options.ledgerPath, markdownLedger(topic, report), "utf8");

  if (options.write) {
    writeJson(options.topicPath, topic);
    console.log(`updated topic: ${options.topicPath}`);
  } else {
    console.log("dry run only; pass --write to update card assetPlan fields");
  }

  console.log(`report: ${options.reportPath}`);
  console.log(`ledger: ${options.ledgerPath}`);
  console.log(`cards planned: ${report.cards.length}`);
  console.log(
    `weak cards: ${report.cards
      .filter((card) => card.status !== "ready")
      .map((card) => String(card.card).padStart(2, "0"))
      .join(", ") || "none"}`,
  );
}

main();
