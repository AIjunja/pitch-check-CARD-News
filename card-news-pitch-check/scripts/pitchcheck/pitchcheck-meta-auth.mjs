#!/usr/bin/env node

import path from "node:path";
import {
  assertExpectedUsername,
  computeExpiresAt,
  extractOAuthCode,
  findWorkspaceRoot,
  parseArgs,
  readApiJson,
  readEnvFile,
  resolvePitchcheckEnv,
  upsertEnvFile,
} from "./lib/social-publish-utils.mjs";

const options = parseArgs();
const command = options._[0] ?? "urls";
const workspaceRoot = findWorkspaceRoot();
const envPath = resolvePitchcheckEnv(options);
bootstrapPitchcheckEnv();
const env = readEnvFile(envPath);

if (command === "urls") {
  printAuthorizationUrls();
} else if (command === "exchange-instagram") {
  await exchangeInstagram();
} else if (command === "save-instagram-token") {
  await saveInstagramToken();
} else if (command === "exchange-threads") {
  await exchangeThreads();
} else if (command === "save-threads-token") {
  await saveThreadsToken();
} else if (command === "verify") {
  await verifyAccounts();
} else {
  throw new Error("Usage: pitchcheck-meta-auth.mjs [urls|exchange-instagram|save-instagram-token|exchange-threads|save-threads-token|verify]");
}

function bootstrapPitchcheckEnv() {
  const sourcePath = path.join(workspaceRoot, "carousel-workspace", "hermes-content.env");
  const source = readEnvFile(sourcePath);
  const current = readEnvFile(envPath);
  const legacyThreadsAppId = "1014807867630414";
  const threadsAppId = !current.PITCHCHECK_THREADS_APP_ID || current.PITCHCHECK_THREADS_APP_ID === legacyThreadsAppId
    ? "1555897602576998"
    : current.PITCHCHECK_THREADS_APP_ID;
  const threadsAppSecret = current.PITCHCHECK_THREADS_APP_SECRET || current.PITCHCHECK_META_APP_SECRET || source.THREADS_APP_SECRET;
  const redirectUri = current.PITCHCHECK_REDIRECT_URI || source.THREADS_REDIRECT_URI || "https://ai-jjun-cdn.pages.dev/oauth/callback/";
  if (!threadsAppId) throw new Error("PitchCheck Threads app ID is missing.");
  upsertEnvFile(envPath, {
    PITCHCHECK_EXPECTED_USERNAME: current.PITCHCHECK_EXPECTED_USERNAME || "pitchcheck_official",
    PITCHCHECK_INSTAGRAM_APP_ID: current.PITCHCHECK_INSTAGRAM_APP_ID || "4451448811789629",
    PITCHCHECK_THREADS_APP_ID: threadsAppId,
    ...(threadsAppSecret ? { PITCHCHECK_THREADS_APP_SECRET: threadsAppSecret } : {}),
    PITCHCHECK_REDIRECT_URI: redirectUri,
    PUBLIC_MEDIA_BASE_URL: current.PUBLIC_MEDIA_BASE_URL || source.PUBLIC_MEDIA_BASE_URL || "https://ai-jjun-cdn.pages.dev/",
    INSTAGRAM_GRAPH_BASE_URL: current.INSTAGRAM_GRAPH_BASE_URL || "https://graph.instagram.com/v25.0",
    THREADS_GRAPH_BASE_URL: current.THREADS_GRAPH_BASE_URL || "https://graph.threads.net/v1.0",
  }, { header: "# PitchCheck-only Meta publishing credentials\n# Keep these separate from the ai_jjuun account.\n" });
}

function printAuthorizationUrls() {
  const redirectUri = env.PITCHCHECK_REDIRECT_URI;
  const instagram = new URL("https://www.instagram.com/oauth/authorize");
  instagram.searchParams.set("force_reauth", "true");
  instagram.searchParams.set("client_id", env.PITCHCHECK_INSTAGRAM_APP_ID);
  instagram.searchParams.set("redirect_uri", redirectUri);
  instagram.searchParams.set("response_type", "code");
  instagram.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");

  const threads = new URL("https://threads.net/oauth/authorize");
  threads.searchParams.set("client_id", env.PITCHCHECK_THREADS_APP_ID);
  threads.searchParams.set("redirect_uri", redirectUri);
  threads.searchParams.set("scope", "threads_basic,threads_content_publish");
  threads.searchParams.set("response_type", "code");
  console.log(JSON.stringify({ envPath, instagram: instagram.toString(), threads: threads.toString() }, null, 2));
}

async function exchangeInstagram() {
  const code = extractOAuthCode(options.callback_url ?? options.code);
  if (!code) throw new Error("--callback-url or --code is required.");
  if (!env.PITCHCHECK_INSTAGRAM_APP_SECRET) {
    throw new Error("PITCHCHECK_INSTAGRAM_APP_SECRET is missing. Use save-instagram-token with a dashboard token instead.");
  }
  const body = new URLSearchParams({
    client_id: env.PITCHCHECK_INSTAGRAM_APP_ID,
    client_secret: env.PITCHCHECK_INSTAGRAM_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: env.PITCHCHECK_REDIRECT_URI,
    code,
  });
  const short = await readApiJson(await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body }), "Instagram short token exchange");
  const exchangeUrl = new URL("https://graph.instagram.com/access_token");
  exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
  exchangeUrl.searchParams.set("client_secret", env.PITCHCHECK_INSTAGRAM_APP_SECRET);
  exchangeUrl.searchParams.set("access_token", short.access_token);
  const long = await readApiJson(await fetch(exchangeUrl), "Instagram long token exchange");
  await persistInstagramToken(long.access_token, long.expires_in);
}

async function saveInstagramToken() {
  const accessToken = String(options.access_token ?? "").trim();
  if (!accessToken) throw new Error("--access-token is required.");
  await persistInstagramToken(accessToken, null);
}

async function persistInstagramToken(accessToken, expiresIn) {
  const profile = await instagramProfile(accessToken);
  assertExpectedUsername(profile.username, env.PITCHCHECK_EXPECTED_USERNAME, "Instagram");
  upsertEnvFile(envPath, {
    INSTAGRAM_ACCESS_TOKEN: accessToken,
    META_ACCESS_TOKEN: accessToken,
    INSTAGRAM_USER_ID: profile.id,
    META_TOKEN_EXPIRES_AT: computeExpiresAt(expiresIn),
  });
  console.log(JSON.stringify({ platform: "instagram", username: profile.username, userId: profile.id, envPath }, null, 2));
}

async function exchangeThreads() {
  const code = extractOAuthCode(options.callback_url ?? options.code);
  if (!code) throw new Error("--callback-url or --code is required.");
  if (!env.PITCHCHECK_THREADS_APP_SECRET) {
    throw new Error("PITCHCHECK_THREADS_APP_SECRET is missing. Use save-threads-token with a dashboard token instead.");
  }
  const body = new URLSearchParams({
    client_id: env.PITCHCHECK_THREADS_APP_ID,
    client_secret: env.PITCHCHECK_THREADS_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: env.PITCHCHECK_REDIRECT_URI,
    code,
  });
  const short = await readApiJson(await fetch("https://graph.threads.net/oauth/access_token", { method: "POST", body }), "Threads short token exchange");
  const exchangeUrl = new URL("https://graph.threads.net/access_token");
  exchangeUrl.searchParams.set("grant_type", "th_exchange_token");
  exchangeUrl.searchParams.set("client_secret", env.PITCHCHECK_THREADS_APP_SECRET);
  exchangeUrl.searchParams.set("access_token", short.access_token);
  const long = await readApiJson(await fetch(exchangeUrl), "Threads long token exchange");
  await persistThreadsToken(long.access_token, long.expires_in);
}

async function saveThreadsToken() {
  const accessToken = String(options.access_token ?? "").trim();
  if (!accessToken) throw new Error("--access-token is required.");
  await persistThreadsToken(accessToken, null);
}

async function persistThreadsToken(accessToken, expiresIn) {
  const profile = await threadsProfile(accessToken);
  assertExpectedUsername(profile.username, env.PITCHCHECK_EXPECTED_USERNAME, "Threads");
  upsertEnvFile(envPath, {
    THREADS_ACCESS_TOKEN: accessToken,
    THREADS_USER_ID: profile.id,
    THREADS_TOKEN_EXPIRES_AT: computeExpiresAt(expiresIn),
  });
  console.log(JSON.stringify({ platform: "threads", username: profile.username, userId: profile.id, envPath }, null, 2));
}

async function verifyAccounts() {
  const instagramToken = env.INSTAGRAM_ACCESS_TOKEN || env.META_ACCESS_TOKEN;
  const instagram = instagramToken ? await instagramProfile(instagramToken) : null;
  const threads = env.THREADS_ACCESS_TOKEN ? await threadsProfile(env.THREADS_ACCESS_TOKEN) : null;
  if (!instagram || !threads) throw new Error("PitchCheck Instagram and Threads tokens have not both been issued.");
  assertExpectedUsername(instagram.username, env.PITCHCHECK_EXPECTED_USERNAME, "Instagram");
  assertExpectedUsername(threads.username, env.PITCHCHECK_EXPECTED_USERNAME, "Threads");
  console.log(JSON.stringify({ instagram: instagram.username, threads: threads.username, expected: env.PITCHCHECK_EXPECTED_USERNAME }, null, 2));
}

async function instagramProfile(token) {
  const url = new URL(`${env.INSTAGRAM_GRAPH_BASE_URL.replace(/\/$/, "")}/me`);
  url.searchParams.set("fields", "id,username,account_type");
  url.searchParams.set("access_token", token);
  return readApiJson(await fetch(url), "Instagram profile verification");
}

async function threadsProfile(token) {
  const url = new URL(`${env.THREADS_GRAPH_BASE_URL.replace(/\/$/, "")}/me`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", token);
  return readApiJson(await fetch(url), "Threads profile verification");
}
