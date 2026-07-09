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
    docs: docs.sort().map(rel),
    captionFile: existsSync(path.join(packageDir, "docs", "caption.md"))
      ? rel(path.join(packageDir, "docs", "caption.md"))
      : null,
    captionText,
    upload: {
      status: "ready-for-uploader",
      commandEnv: "PITCHCHECK_UPLOAD_COMMAND",
      commandTemplate:
        "Set PITCHCHECK_UPLOAD_COMMAND to a platform uploader. Tokens available: {manifest}, {packageDir}, {captionFile}, {cards}.",
      dryRunCommand: `node scripts/pitchcheck/upload-package.mjs ${rel(path.join(packageDir, "upload-manifest.json"))} --dry-run`,
    },
  };

  const manifestPath = path.join(packageDir, "upload-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Upload package: ${rel(packageDir)}`);
  console.log(`Manifest: ${rel(manifestPath)}`);
  console.log(`Cards: ${manifest.cardImages.length}`);
}

main();
