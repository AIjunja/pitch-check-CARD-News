#!/usr/bin/env node

import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  return {
    manifestPath: positional[0] ? path.resolve(ROOT, positional[0]) : null,
    dryRun: args.includes("--dry-run") || !args.includes("--real"),
  };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function shellEscapeForTemplate(value) {
  return String(value).replaceAll('"', '\\"');
}

function fillTemplate(command, manifest, manifestPath) {
  const packageDir = path.resolve(ROOT, manifest.packageDir);
  const captionFile = manifest.captionFile ? path.resolve(ROOT, manifest.captionFile) : "";
  const cards = (manifest.cardImages || []).map((item) => path.resolve(ROOT, item)).join(" ");
  return command
    .replaceAll("{manifest}", shellEscapeForTemplate(manifestPath))
    .replaceAll("{packageDir}", shellEscapeForTemplate(packageDir))
    .replaceAll("{captionFile}", shellEscapeForTemplate(captionFile))
    .replaceAll("{cards}", shellEscapeForTemplate(cards));
}

function writeDryRunLog(manifestPath, manifest) {
  const packageDir = path.resolve(ROOT, manifest.packageDir);
  const logPath = path.join(packageDir, "upload-dry-run.log");
  const lines = [
    `Dry run: ${new Date().toISOString()}`,
    `Manifest: ${rel(manifestPath)}`,
    `Title: ${manifest.title}`,
    `Cards: ${(manifest.cardImages || []).length}`,
    "",
    "Card order:",
    ...(manifest.cardImages || []).map((item, index) => `${index + 1}. ${item}`),
    "",
    "Caption:",
    manifest.captionText || "",
    "",
    "To run a real uploader:",
    "1. Set PITCHCHECK_UPLOAD_COMMAND.",
    "2. Run this script with --real.",
    "",
    "Example:",
    'PITCHCHECK_UPLOAD_COMMAND="node ../tools/publish/publish-instagram.mjs --manifest {manifest}" node scripts/pitchcheck/upload-package.mjs <manifest> --real',
  ];
  writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");
  return logPath;
}

function main() {
  const opts = parseArgs();
  if (!opts.manifestPath) {
    throw new Error("Usage: node scripts/pitchcheck/upload-package.mjs <upload-manifest.json> [--dry-run|--real]");
  }
  if (!existsSync(opts.manifestPath)) throw new Error(`Manifest not found: ${opts.manifestPath}`);

  const manifest = readJson(opts.manifestPath);
  const commandTemplate = process.env.PITCHCHECK_UPLOAD_COMMAND;

  if (opts.dryRun || !commandTemplate) {
    const logPath = writeDryRunLog(opts.manifestPath, manifest);
    console.log(`Upload dry-run OK: ${rel(logPath)}`);
    console.log(`Cards: ${(manifest.cardImages || []).length}`);
    console.log(`Set PITCHCHECK_UPLOAD_COMMAND and pass --real to execute a platform uploader.`);
    return;
  }

  const command = fillTemplate(commandTemplate, manifest, opts.manifestPath);
  const packageDir = path.resolve(ROOT, manifest.packageDir);
  const captionFile = manifest.captionFile ? path.resolve(ROOT, manifest.captionFile) : "";

  console.log(`Running uploader: ${command}`);
  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      PITCHCHECK_UPLOAD_MANIFEST: opts.manifestPath,
      PITCHCHECK_UPLOAD_DIR: packageDir,
      PITCHCHECK_UPLOAD_CAPTION_FILE: captionFile,
      PITCHCHECK_UPLOAD_CARDS: (manifest.cardImages || []).map((item) => path.resolve(ROOT, item)).join(path.delimiter),
    },
  });

  if (result.status !== 0) {
    throw new Error(`Uploader failed with exit code ${result.status}`);
  }

  console.log("Upload command finished.");
}

main();
