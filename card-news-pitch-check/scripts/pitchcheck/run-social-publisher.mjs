#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertExpectedUsername,
  findWorkspaceRoot,
  loadEnvIntoProcess,
  parseArgs,
  readApiJson,
  readJson,
  resolvePitchcheckEnv,
  writeJson,
} from "./lib/social-publish-utils.mjs";

const options = parseArgs();
const execute = options.execute === true;
const workspaceRoot = findWorkspaceRoot();
const envPath = resolvePitchcheckEnv(options);
const queuePath = path.resolve(options.queue ?? path.join(workspaceRoot, "carousel-workspace", "pitchcheck-publish-queue.json"));
const historyPath = path.resolve(options.history ?? path.join(workspaceRoot, "carousel-workspace", "pitchcheck-publish-history.jsonl"));
const cdnRepo = path.resolve(options.cdn_repo ?? path.join(workspaceRoot, "ai-jjun-cdn"));
const lockPath = `${queuePath}.lock`;

if (!fs.existsSync(queuePath)) throw new Error(`큐 파일이 없습니다: ${queuePath}`);
if (!fs.existsSync(path.join(cdnRepo, "scripts", "publish-to-meta.mjs"))) throw new Error(`CDN 게시기를 찾지 못했습니다: ${cdnRepo}`);
const env = loadEnvIntoProcess(envPath);
const queue = readJson(queuePath);
const expected = queue.expectedUsername ?? env.PITCHCHECK_EXPECTED_USERNAME ?? "pitchcheck_official";
await verifyAccounts(env, expected);

const now = options.now ? new Date(options.now) : new Date();
const item = queue.items.find((candidate) => {
  const pending = ["instagram", "threads"].some((platform) => candidate.platforms?.[platform]?.status !== "published");
  return pending && new Date(candidate.scheduledAt).getTime() <= now.getTime();
});

if (!item) {
  console.log(JSON.stringify({ status: "idle", now: now.toISOString(), next: nextPending(queue)?.scheduledAt ?? null }, null, 2));
  process.exit(0);
}

if (!execute) {
  console.log(JSON.stringify({ status: "dry-run", item: item.id, slug: item.slug, scheduledAt: item.scheduledAt, platforms: item.platforms }, null, 2));
  process.exit(0);
}

const lockHandle = acquireLock(lockPath);
try {
  for (const platform of ["instagram", "threads"]) {
    if (item.platforms[platform].status === "published") continue;
    try {
      const result = publishPlatform(platform, item.slug, env);
      item.platforms[platform] = {
        status: "published",
        publishedAt: new Date().toISOString(),
        mediaId: result.mediaId,
        lastError: null,
      };
      writeJson(queuePath, queue);
      appendHistory({ itemId: item.id, slug: item.slug, platform, status: "published", mediaId: result.mediaId });
    } catch (error) {
      item.platforms[platform] = { ...item.platforms[platform], status: "failed", lastError: error.message, lastAttemptAt: new Date().toISOString() };
      writeJson(queuePath, queue);
      appendHistory({ itemId: item.id, slug: item.slug, platform, status: "failed", error: error.message });
      throw error;
    }
  }
  console.log(JSON.stringify({ status: "published", item: item.id, platforms: item.platforms }, null, 2));
} finally {
  fs.closeSync(lockHandle);
  fs.rmSync(lockPath, { force: true });
}

function publishPlatform(platform, slug, childEnv) {
  const args = ["scripts/publish-to-meta.mjs", "--slug", slug, "--platform", platform, "--kind", "carousel", "--publish"];
  const result = spawnSync(process.execPath, args, {
    cwd: cdnRepo,
    env: { ...process.env, ...childEnv },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${platform} 게시 실패: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
  const match = result.stdout.match(/published:\s*([0-9]+)/i);
  if (!match) throw new Error(`${platform} 게시 응답 ID를 확인하지 못했습니다.`);
  return { mediaId: match[1] };
}

async function verifyAccounts(config, expectedUsername) {
  const instagramToken = config.INSTAGRAM_ACCESS_TOKEN || config.META_ACCESS_TOKEN;
  if (!instagramToken || !config.THREADS_ACCESS_TOKEN) {
    throw new Error(`피치체크 전용 토큰이 없습니다. 먼저 인증을 완료하세요: ${envPath}`);
  }
  const instagramUrl = new URL(`${config.INSTAGRAM_GRAPH_BASE_URL.replace(/\/$/, "")}/me`);
  instagramUrl.searchParams.set("fields", "id,username");
  instagramUrl.searchParams.set("access_token", instagramToken);
  const instagram = await readApiJson(await fetch(instagramUrl), "Instagram 계정 확인");

  const threadsUrl = new URL(`${config.THREADS_GRAPH_BASE_URL.replace(/\/$/, "")}/me`);
  threadsUrl.searchParams.set("fields", "id,username");
  threadsUrl.searchParams.set("access_token", config.THREADS_ACCESS_TOKEN);
  const threads = await readApiJson(await fetch(threadsUrl), "Threads 계정 확인");
  assertExpectedUsername(instagram.username, expectedUsername, "Instagram");
  assertExpectedUsername(threads.username, expectedUsername, "Threads");
}

function acquireLock(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    return fs.openSync(filePath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("다른 피치체크 게시 실행이 진행 중입니다.");
    throw error;
  }
}

function nextPending(data) {
  return data.items.find((candidate) => ["instagram", "threads"].some((platform) => candidate.platforms?.[platform]?.status !== "published"));
}

function appendHistory(entry) {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}
