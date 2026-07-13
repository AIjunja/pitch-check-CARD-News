#!/usr/bin/env node

import http from "node:http";
import {
  assertExpectedUsername,
  computeExpiresAt,
  parseArgs,
  readApiJson,
  readEnvFile,
  resolvePitchcheckEnv,
  upsertEnvFile,
} from "./lib/social-publish-utils.mjs";

const options = parseArgs();
const envPath = resolvePitchcheckEnv(options);
const env = readEnvFile(envPath);
const port = Number(options.port ?? 43761);
const state = String(options.state ?? "");

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be between 1024 and 65535.");
if (!/^pitchcheck-local-\d{4,5}-[A-Za-z0-9_-]{16,}$/.test(state)) throw new Error("A valid --state is required.");
if (!env.PITCHCHECK_INSTAGRAM_APP_ID || !env.PITCHCHECK_INSTAGRAM_APP_SECRET) {
  throw new Error("PitchCheck Instagram app credentials are missing.");
}

const redirectUri = env.PITCHCHECK_REDIRECT_URI;
const authorizeUrl = new URL("https://www.instagram.com/oauth/authorize");
authorizeUrl.searchParams.set("force_reauth", "true");
authorizeUrl.searchParams.set("client_id", env.PITCHCHECK_INSTAGRAM_APP_ID);
authorizeUrl.searchParams.set("redirect_uri", redirectUri);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
authorizeUrl.searchParams.set("state", state);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname !== "/oauth/callback") {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    if (url.searchParams.get("state") !== state) throw new Error("OAuth state mismatch.");
    if (url.searchParams.get("error")) throw new Error(url.searchParams.get("error_description") || url.searchParams.get("error"));
    const code = url.searchParams.get("code");
    if (!code) throw new Error("OAuth code is missing.");
    const tokenBody = new URLSearchParams({
      client_id: env.PITCHCHECK_INSTAGRAM_APP_ID,
      client_secret: env.PITCHCHECK_INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const short = await readApiJson(await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: tokenBody }), "Instagram short token exchange");
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", env.PITCHCHECK_INSTAGRAM_APP_SECRET);
    longUrl.searchParams.set("access_token", short.access_token);
    const long = await readApiJson(await fetch(longUrl), "Instagram long token exchange");
    const profileUrl = new URL(`${(env.INSTAGRAM_GRAPH_BASE_URL || "https://graph.instagram.com/v25.0").replace(/\/$/, "")}/me`);
    profileUrl.searchParams.set("fields", "id,username,account_type");
    profileUrl.searchParams.set("access_token", long.access_token);
    const profile = await readApiJson(await fetch(profileUrl), "Instagram profile verification");
    assertExpectedUsername(profile.username, env.PITCHCHECK_EXPECTED_USERNAME, "Instagram");
    upsertEnvFile(envPath, {
      INSTAGRAM_ACCESS_TOKEN: long.access_token,
      META_ACCESS_TOKEN: long.access_token,
      INSTAGRAM_USER_ID: profile.id,
      META_TOKEN_EXPIRES_AT: computeExpiresAt(long.expires_in),
    });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(resultPage("PitchCheck Instagram 연결 완료", `@${profile.username} 계정이 확인되었습니다. 이 창을 닫아도 됩니다.`));
    console.log(JSON.stringify({ status: "complete", username: profile.username, userId: profile.id, envPath }));
  } catch (error) {
    response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    response.end(resultPage("PitchCheck Instagram 연결 실패", error.message));
    console.error(JSON.stringify({ status: "failed", message: error.message }));
    process.exitCode = 1;
  } finally {
    setTimeout(() => server.close(), 250);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ status: "listening", port, authorizeUrl: authorizeUrl.toString() }));
});

function resultPage(title, message) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071015;color:#fff;font-family:system-ui}main{width:min(620px,calc(100vw - 40px));padding:32px;background:#111e26;border-radius:12px}p{color:#b9c7d3;line-height:1.7}</style><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></html>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
