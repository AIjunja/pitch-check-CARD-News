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

const DEFAULT_PRODUCT_ORDER = [
  "pitchcheck-screen-001",
  "pitchcheck-screen-002",
  "pitchcheck-video-001",
  "pitchcheck-video-005",
  "pitchcheck-video-007",
  "pitchcheck-video-009",
  "pitchcheck-video-011",
  "pitchcheck-video-013",
  "pitchcheck-video-017",
  "pitchcheck-video-019",
  "pitchcheck-video-021",
  "pitchcheck-video-023",
  "pitchcheck-video-024",
  "pitchcheck-video-025",
  "pitchcheck-video-027",
  "pitchcheck-video-028",
  "pitchcheck-video-029",
];

const DEFAULT_BLOCKED_IDS = new Set([
  "pitchcheck-video-003",
  "pitchcheck-video-015",
  "pitchcheck-video-016",
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

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const topicPath = positional[0] || "samples/pitchcheck/lampard-fines-real-cta.json";
  const manifestIndex = args.indexOf("--manifest");
  const reportIndex = args.indexOf("--report");

  return {
    topicPath: path.resolve(ROOT, topicPath),
    manifestPath:
      manifestIndex >= 0
        ? path.resolve(ROOT, args[manifestIndex + 1])
        : path.join(ROOT, "assets", "reference", "pitchcheck-local", "media-manifest.json"),
    reportPath:
      reportIndex >= 0
        ? path.resolve(ROOT, args[reportIndex + 1])
        : path.join(ROOT, "assets", "reference", "pitchcheck-local", "diverse-media-selection.json"),
    write: args.includes("--write"),
    noStoryPool: args.includes("--no-story-pool"),
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
  const base = String(value || "media");
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const hash = createHash("sha1").update(base).digest("hex").slice(0, 8);
  return `${slug || "media"}-${hash}`;
}

function candidateId(item) {
  if (item.type === "pitchcheck-video-frame") {
    return item.id.replace(/^pitchcheck-video-/, "video-");
  }
  if (item.type === "pitchcheck-screen") {
    return item.id.replace(/^pitchcheck-screen-/, "screen-");
  }
  return item.id;
}

function candidateText(item) {
  return [item.id, item.type, item.usage, item.source, item.file, item.repoPath]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isBlocked(item) {
  if (DEFAULT_BLOCKED_IDS.has(item.id)) return true;
  const text = candidateText(item);
  return BLOCKED_TEXT.some((word) => text.includes(word));
}

function mediaObjectFromCandidate(item, topicPath, usage) {
  const id = candidateId(item);
  return {
    id,
    path: pathForTopic(item.repoPath, topicPath),
    alt: item.alt || `${item.type} ${id}`,
    credit:
      item.type === "football-reference"
        ? "Local football reference"
        : "Local PitchCheck media",
    usage: usage || item.usage || "diverse media candidate",
  };
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

function scanRepoImageCandidates() {
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
      const parsed = path.parse(filePath);
      const topicDir = path.basename(path.dirname(filePath));
      const sharedAsset = rel.includes("/shared/");

      return {
        id: `repo-${safeId(`${topicDir}-${parsed.name}`)}`,
        type: sharedAsset ? "repo-shared-product" : "repo-football-story",
        usage: sharedAsset
          ? "Repository PitchCheck UI reference"
          : "Repository football story candidate",
        source: rel,
        file: filePath,
        repoPath: rel,
      };
    });
}

function spreadPick(items, count, groupForItem = () => "all") {
  const selected = [];
  const seenGroups = new Set();

  for (const item of items) {
    const group = groupForItem(item);
    if (seenGroups.has(group)) continue;
    selected.push(item);
    seenGroups.add(group);
    if (selected.length >= count) return selected;
  }

  for (const item of items) {
    if (selected.includes(item)) continue;
    selected.push(item);
    if (selected.length >= count) return selected;
  }

  return selected;
}

function ensureMedia(topic, item, topicPath, usage, report) {
  const media = mediaObjectFromCandidate(item, topicPath, usage);
  const existing = topic.media.find((entry) => entry.id === media.id);
  if (existing) {
    return existing.id;
  }

  const normalizedPath = media.path.replaceAll("\\", "/");
  const duplicate = topic.media.find(
    (entry) => (entry.path || "").replaceAll("\\", "/") === normalizedPath,
  );
  if (duplicate) {
    return duplicate.id;
  }

  topic.media.push(media);
  report.addedMedia.push(media.id);
  return media.id;
}

function findByManifestId(candidates, manifestId) {
  return candidates.find((item) => item.id === manifestId);
}

function applyDiverseMedia(topic, topicPath, manifest, repoCandidates, options = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    topic: repoPath(topicPath),
    addedMedia: [],
    selected: {
      storyPool: [],
      pitchcheckGallery: [],
      ctaGallery: [],
    },
    blockedIds: [...DEFAULT_BLOCKED_IDS],
    notes: [
      "Candidates are selected from local/user-provided media and repository assets.",
      "Blocked frames are excluded before card galleries are updated.",
    ],
  };

  topic.media ||= [];
  topic.search ||= [];

  const manifestItems = (manifest.items || [])
    .filter((item) => item.file && item.repoPath && existsSync(item.file))
    .filter((item) => !isBlocked(item));

  const productCandidates = DEFAULT_PRODUCT_ORDER
    .map((id) => findByManifestId(manifestItems, id))
    .filter(Boolean);
  const fallbackProduct = manifestItems
    .filter((item) => item.type === "pitchcheck-video-frame" || item.type === "pitchcheck-screen")
    .filter((item) => !productCandidates.includes(item));

  const productPool = [...productCandidates, ...fallbackProduct];
  const pitchcheckGalleryItems = productPool
    .filter((item) => item.type === "pitchcheck-video-frame")
    .slice(0, 6);
  const ctaGalleryItems = spreadPick(productPool, 12, (item) => item.type);

  const pitchcheckGallery = pitchcheckGalleryItems.map((item) =>
    ensureMedia(topic, item, topicPath, "PitchCheck app proof gallery", report),
  );
  const ctaGallery = ctaGalleryItems.map((item) =>
    ensureMedia(topic, item, topicPath, "PitchCheck install CTA mosaic", report),
  );

  const footballCandidates = [
    ...manifestItems.filter((item) => item.type === "football-reference"),
    ...repoCandidates.filter((item) => item.type === "repo-football-story"),
  ].filter((item) => !isBlocked(item));

  const storyPool = topic.cards
    ? spreadPick(footballCandidates, Math.min(8, Math.max(0, topic.cards.length - 2)), (item) => {
        const parts = item.repoPath.split("/");
        return parts.includes("assets") ? parts.slice(0, 4).join("/") : item.type;
      })
    : [];

  if (
    !options.noStoryPool &&
    !topic.project?.keepStoryMedia &&
    !topic.noDiverseStoryPool &&
    !process.env.PITCHCHECK_NO_STORY_POOL
  ) {
    for (const item of storyPool) {
      ensureMedia(topic, item, topicPath, "Diverse football story candidate", report);
    }
  }

  const penultimate = topic.cards?.[topic.cards.length - 2];
  if (penultimate?.type === "pitchcheck" && pitchcheckGallery.length >= 3) {
    penultimate.mediaGallery = pitchcheckGallery;
    report.selected.pitchcheckGallery = pitchcheckGallery;
  }

  const final = topic.cards?.[topic.cards.length - 1];
  if (final?.type === "cta" && ctaGallery.length >= 6) {
    final.mediaGallery = ctaGallery;
    report.selected.ctaGallery = ctaGallery;
  }

  report.selected.storyPool = storyPool.map((item) => candidateId(item));

  const intent = {
    query: "local PitchCheck app frames + football story references",
    purpose:
      "Expand automatic media discovery, exclude off-topic frames, and assign diverse assets to PitchCheck proof/CTA cards.",
    preferredSources: [
      "assets/reference/pitchcheck-local/media-manifest.json",
      "assets/images/**/*",
      "user-provided local media",
    ],
  };
  const hasIntent = topic.search.some((item) => item.query === intent.query);
  if (!hasIntent) topic.search.push(intent);

  return report;
}

function main() {
  const options = parseArgs();
  if (!existsSync(options.topicPath)) {
    throw new Error(`Missing topic JSON: ${options.topicPath}`);
  }
  if (!existsSync(options.manifestPath)) {
    throw new Error(`Missing media manifest: ${options.manifestPath}`);
  }

  const topic = readJson(options.topicPath);
  const manifest = readJson(options.manifestPath);
  const repoCandidates = scanRepoImageCandidates();
  const report = applyDiverseMedia(topic, options.topicPath, manifest, repoCandidates, options);

  mkdirSync(path.dirname(options.reportPath), { recursive: true });
  writeJson(options.reportPath, report);

  if (options.write) {
    writeJson(options.topicPath, topic);
    console.log(`updated topic: ${options.topicPath}`);
  } else {
    console.log("dry run only; pass --write to update the topic JSON");
  }
  console.log(`report: ${options.reportPath}`);
  console.log(`added media: ${report.addedMedia.length}`);
  console.log(`pitchcheck gallery: ${report.selected.pitchcheckGallery.join(", ")}`);
  console.log(`cta gallery: ${report.selected.ctaGallery.join(", ")}`);
}

main();
