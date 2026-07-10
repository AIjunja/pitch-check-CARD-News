#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryBank } from "./lib/real-story-validation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MESSI_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-messi.json");
const RONALDO_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-ronaldo.json");
const DEFAULT_OUTPUT_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-global.json");

export function buildGlobalLegendBank(messiSeeds, ronaldoSeeds) {
  const messiSourceRefs = messiSeeds?.sourceRefs;
  const ronaldoSourceRefs = ronaldoSeeds?.sourceRefs;
  const messiTopics = messiSeeds?.topics;
  const ronaldoTopics = ronaldoSeeds?.topics;

  if (!messiSourceRefs || !ronaldoSourceRefs || !Array.isArray(messiTopics) || !Array.isArray(ronaldoTopics)) {
    throw new Error("Messi and Ronaldo seed banks must contain sourceRefs and topics");
  }

  const sourceRefs = { ...messiSourceRefs, ...ronaldoSourceRefs };
  if (Object.keys(sourceRefs).length !== Object.keys(messiSourceRefs).length + Object.keys(ronaldoSourceRefs).length) {
    throw new Error("Messi and Ronaldo seed sourceRefs must be unique");
  }

  return {
    name: "PitchCheck global legend story seeds",
    sourceRefs,
    topics: [...messiTopics, ...ronaldoTopics],
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonAtomically(filePath, value) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  try {
    fs.writeFileSync(temporaryPath, serialized, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
}

export function generateGlobalLegendBank(outputPath = DEFAULT_OUTPUT_PATH) {
  const messiSeeds = readJson(MESSI_SEEDS_PATH);
  const ronaldoSeeds = readJson(RONALDO_SEEDS_PATH);
  const globalSeeds = buildGlobalLegendBank(messiSeeds, ronaldoSeeds);

  validateStoryBank(globalSeeds, { expectedCount: 40 });
  writeJsonAtomically(outputPath, globalSeeds);
  return globalSeeds;
}

function parseOutputPath(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex === -1) {
    return DEFAULT_OUTPUT_PATH;
  }

  const outputValue = argv[outputIndex + 1];
  if (!outputValue) {
    throw new Error("--output requires a file path");
  }
  return path.resolve(process.cwd(), outputValue);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = parseOutputPath(process.argv.slice(2));
  generateGlobalLegendBank(outputPath);
  console.log(`wrote ${path.relative(ROOT, outputPath)}`);
}
