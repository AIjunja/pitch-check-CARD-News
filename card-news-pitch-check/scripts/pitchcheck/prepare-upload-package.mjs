#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const outIndex = args.indexOf("--out-dir");
  return {
    input: positional[0] ? path.resolve(ROOT, positional[0]) : null,
    outDir: outIndex >= 0 ? path.resolve(ROOT, args[outIndex + 1]) : path.join(ROOT, "dist", "uploads"),
    clean: !args.includes("--no-clean"),
  };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function safeName(value) {
  return String(value || "item")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9가-힣.-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function readPngSize(file) {
  const buffer = readFileSync(file);
  const isPng =
    buffer.length > 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  if (!isPng) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function inspectCardImage(file) {
  const ext = path.extname(file).toLowerCase();
  const size = statSync(file).size;
  const dimensions = ext === ".png" ? readPngSize(file) : null;
  const errors = [];
  const warnings = [];

  if (![".png", ".jpg", ".jpeg"].includes(ext)) {
    errors.push("Instagram carousel image should be PNG/JPEG at packaging time.");
  }
  if (!dimensions) {
    warnings.push("Image dimensions were not detected; PNG header check is available for rendered cards.");
  } else {
    if (dimensions.width !== 1080 || dimensions.height !== 1350) {
      errors.push(`Expected 1080x1350, got ${dimensions.width}x${dimensions.height}.`);
    }
    const ratio = dimensions.width / dimensions.height;
    if (Math.abs(ratio - 0.8) > 0.001) {
      errors.push(`Expected 4:5 aspect ratio, got ${ratio.toFixed(3)}.`);
    }
  }
  if (size <= 0) errors.push("Image file is empty.");

  return {
    file: rel(file),
    ext,
    bytes: size,
    dimensions,
    status: errors.length ? "fail" : "pass",
    errors,
    warnings,
  };
}

function buildCarouselHarness(cardImages, captionText) {
  const sortedCards = cardImages.sort();
  const imageChecks = sortedCards.map(inspectCardImage);
  const errors = [];
  const warnings = [];

  if (sortedCards.length < 2) {
    errors.push("Instagram carousel needs at least 2 images.");
  }
  if (sortedCards.length > 20) {
    errors.push("Instagram app carousel uploads can include up to 20 images; split this package.");
  }
  if (sortedCards.length > 10) {
    warnings.push("Meta Graph API carousel publishing commonly supports fewer children than the app UI; verify the real uploader before API posting.");
  }
  if (!captionText.trim()) {
    warnings.push("Caption is empty. Add caption before upload.");
  }
  for (const item of imageChecks) {
    errors.push(...item.errors.map((message) => `${path.basename(item.file)}: ${message}`));
    warnings.push(...item.warnings.map((message) => `${path.basename(item.file)}: ${message}`));
  }

  return {
    status: errors.length ? "blocked" : "ready",
    platform: "instagram",
    contentType: "feed-carousel-post",
    notAReelVideo: true,
    intendedSurface: "Instagram feed carousel with optional music; it may appear in full-screen recommendation surfaces, but that is controlled by Instagram.",
    cardCount: sortedCards.length,
    requiredCardSpec: {
      width: 1080,
      height: 1350,
      aspectRatio: "4:5",
      formats: ["png", "jpg", "jpeg"],
      safeAreaNote: "Keep core headline away from the lower caption/controls area and the right-side action rail when Instagram shows the carousel full-screen.",
    },
    uploadSteps: [
      "Open Instagram and choose Post, not Reel.",
      "Select the rendered card images in order.",
      "Add music during the post upload flow if the account/app UI exposes Add music.",
      "Add caption, tags, collaborators, and share as a carousel post.",
    ],
    recommendationNote:
      "There is no guaranteed switch for Reels-tab placement. The package is prepared as a music-capable carousel post candidate, not as an MP4 Reel.",
    apiNote:
      "If using an uploader, it must create an Instagram carousel/feed post. Music attachment may require a manual Instagram app step unless the uploader explicitly supports it.",
    imageChecks,
    errors,
    warnings,
  };
}

function markdownForCarouselHarness(harness) {
  const lines = [
    "# Instagram Carousel Upload Harness",
    "",
    `Status: ${harness.status}`,
    "",
    "## Target",
    "",
    "- Upload type: Instagram feed carousel post",
    "- Do not upload these cards as a Reel MP4 if the goal is swipeable 1/N carousel UI.",
    "- Optional music should be added in the Instagram post upload flow when available.",
    "",
    "## Checks",
    "",
    `- Card count: ${harness.cardCount}`,
    `- Required size: ${harness.requiredCardSpec.width}x${harness.requiredCardSpec.height}`,
    `- Required ratio: ${harness.requiredCardSpec.aspectRatio}`,
    "",
  ];

  if (harness.errors.length) {
    lines.push("## Blocking Errors", "", ...harness.errors.map((item) => `- ${item}`), "");
  }
  if (harness.warnings.length) {
    lines.push("## Warnings", "", ...harness.warnings.map((item) => `- ${item}`), "");
  }

  lines.push("## Upload Steps", "", ...harness.uploadSteps.map((item, index) => `${index + 1}. ${item}`), "");
  lines.push("## Image Checks", "");
  lines.push("| Card | Status | Dimensions | Bytes | Notes |");
  lines.push("| --- | --- | --- | ---: | --- |");
  for (const item of harness.imageChecks) {
    const dims = item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` : "unknown";
    const notes = [...item.errors, ...item.warnings].join("<br>") || "";
    lines.push(`| ${item.file} | ${item.status} | ${dims} | ${item.bytes} | ${notes} |`);
  }
  lines.push("");
  lines.push("## Notes", "", `- ${harness.recommendationNote}`, `- ${harness.apiNote}`, "");
  return `${lines.join("\n")}\n`;
}

function resolveProject(input) {
  if (!input) throw new Error("Usage: node scripts/pitchcheck/prepare-upload-package.mjs <topic-json-or-project-dir>");
  if (!existsSync(input)) throw new Error(`Input not found: ${input}`);

  const stat = statSync(input);
  if (stat.isDirectory()) {
    const indexPath = path.join(input, "index.html");
    if (!existsSync(indexPath)) throw new Error(`Project directory is missing index.html: ${input}`);
    const slug = path.basename(input);
    return { projectDir: input, slug, topic: null, topicPath: null };
  }

  const topic = readJson(input);
  const slug = safeName(topic.project?.slug);
  const projectDir = path.join(ROOT, "projects", slug);
  if (!existsSync(projectDir)) {
    throw new Error(`Rendered project not found: ${projectDir}\nRun render first: node scripts/pitchcheck/render-carousel.mjs ${rel(input)}`);
  }
  return { projectDir, slug, topic, topicPath: input };
}

function copyDirFiles(srcDir, dstDir, predicate = () => true) {
  mkdirSync(dstDir, { recursive: true });
  const copied = [];
  if (!existsSync(srcDir)) return copied;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const src = path.join(srcDir, entry.name);
    if (!predicate(src)) continue;
    const dst = path.join(dstDir, entry.name);
    copyFileSync(src, dst);
    copied.push(dst);
  }
  return copied;
}

function maybeCopy(src, dstDir) {
  if (!existsSync(src)) return null;
  mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, path.basename(src));
  copyFileSync(src, dst);
  return dst;
}

function main() {
  const opts = parseArgs();
  const { projectDir, slug, topic, topicPath } = resolveProject(opts.input);
  const packageDir = path.join(opts.outDir, slug);

  if (opts.clean && existsSync(packageDir)) {
    rmSync(packageDir, { recursive: true, force: true });
  }
  mkdirSync(packageDir, { recursive: true });

  const cardsDir = path.join(packageDir, "cards");
  const docsDir = path.join(packageDir, "docs");
  const outputDir = path.join(projectDir, "output");
  const cardImages = copyDirFiles(outputDir, cardsDir, (file) => /^card-\d+\.png$/i.test(path.basename(file)));
  const sheets = copyDirFiles(outputDir, packageDir, (file) => /sheet\.png$/i.test(path.basename(file)));
  const docs = [
    maybeCopy(path.join(projectDir, "caption.md"), docsDir),
    maybeCopy(path.join(projectDir, "source-pack.md"), docsDir),
    maybeCopy(path.join(projectDir, "storyboard.md"), docsDir),
    maybeCopy(path.join(projectDir, "motion-plan.md"), docsDir),
    maybeCopy(path.join(projectDir, "index.html"), docsDir),
  ].filter(Boolean);

  if (!cardImages.length) {
    throw new Error(`No rendered card images found in ${outputDir}`);
  }

  const captionPath = path.join(projectDir, "caption.md");
  const captionText = existsSync(captionPath) ? readFileSync(captionPath, "utf8").trim() : "";
  const carouselHarness = buildCarouselHarness(cardImages, captionText);
  const carouselChecklistPath = path.join(packageDir, "carousel-upload-checklist.md");
  writeFileSync(carouselChecklistPath, markdownForCarouselHarness(carouselHarness), "utf8");

  const manifest = {
    createdAt: new Date().toISOString(),
    slug,
    title: topic?.project?.title || slug,
    platformIntent: "instagram-carousel",
    topicJson: topicPath ? rel(topicPath) : null,
    renderedProjectDir: rel(projectDir),
    packageDir: rel(packageDir),
    cardImages: cardImages.sort().map(rel),
    sheets: sheets.sort().map(rel),
    docs: [...docs, carouselChecklistPath].sort().map(rel),
    captionFile: existsSync(path.join(packageDir, "docs", "caption.md"))
      ? rel(path.join(packageDir, "docs", "caption.md"))
      : null,
    captionText,
    carouselUploadHarness: carouselHarness,
    upload: {
      status: carouselHarness.status === "ready" ? "ready-for-carousel-uploader" : "blocked-by-carousel-harness",
      commandEnv: "PITCHCHECK_UPLOAD_COMMAND",
      commandTemplate:
        "Set PITCHCHECK_UPLOAD_COMMAND to a feed-carousel uploader. Tokens available: {manifest}, {packageDir}, {captionFile}, {cards}.",
      dryRunCommand: `node scripts/pitchcheck/upload-package.mjs ${rel(path.join(packageDir, "upload-manifest.json"))} --dry-run`,
    },
  };

  const manifestPath = path.join(packageDir, "upload-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Upload package: ${rel(packageDir)}`);
  console.log(`Manifest: ${rel(manifestPath)}`);
  console.log(`Cards: ${manifest.cardImages.length}`);
  console.log(`Carousel harness: ${carouselHarness.status}`);
  if (carouselHarness.errors.length) {
    console.log(`Blocking errors: ${carouselHarness.errors.length}`);
  }
}

main();
