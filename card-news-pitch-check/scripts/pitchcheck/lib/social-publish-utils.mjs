import fs from "node:fs";
import path from "node:path";

export function parseArgs(values = process.argv.slice(2)) {
  const options = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      options._.push(value);
      continue;
    }
    const key = value.slice(2).replaceAll("-", "_");
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

export function findWorkspaceRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, "carousel-workspace"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("Could not find a workspace root containing carousel-workspace.");
}

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function upsertEnvFile(filePath, updates, { header = "" } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "") : header;
  const lines = existing.split(/\r?\n/);
  const seen = new Set();
  const next = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || updates[match[1]] === undefined) return line;
    seen.add(match[1]);
    return `${match[1]}=${updates[match[1]]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, `${next.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`, "utf8");
}

export function resolvePitchcheckEnv(options = {}) {
  const workspaceRoot = findWorkspaceRoot();
  return path.resolve(options.env ?? path.join(workspaceRoot, "carousel-workspace", "pitchcheck-content.env"));
}

export function loadEnvIntoProcess(filePath) {
  const values = readEnvFile(filePath);
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  return values;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function extractOAuthCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(new URL(raw).searchParams.get("code") ?? "").replace(/#_$/, "");
  } catch {
    return decodeURIComponent(raw).replace(/#_$/, "");
  }
}

export function computeExpiresAt(expiresIn, fallbackDays = 60) {
  const seconds = Number.isFinite(Number(expiresIn)) ? Number(expiresIn) : fallbackDays * 24 * 60 * 60;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function readApiJson(response, label) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} failed: HTTP ${response.status}`);
  }
  if (!response.ok || data.error) {
    const message = data?.error?.message ?? data?.error_message ?? `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${message}`);
  }
  return data;
}

export function assertExpectedUsername(actual, expected, platform) {
  if (String(actual ?? "").toLowerCase() !== String(expected ?? "").toLowerCase()) {
    throw new Error(`${platform} account mismatch: expected @${expected}, received @${actual || "unknown"}. Publishing stopped.`);
  }
}
