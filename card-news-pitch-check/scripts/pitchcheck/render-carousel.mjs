#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CARD_W = 1080;
const CARD_H = 1350;

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const input = positional[0] || "samples/pitchcheck/lampard-fines.json";
  const outIndex = args.indexOf("--out");
  return {
    input: path.resolve(ROOT, input),
    outRoot: outIndex >= 0 ? path.resolve(ROOT, args[outIndex + 1]) : path.join(ROOT, "projects"),
    dryRun: args.includes("--dry-run"),
    allowNonCta: args.includes("--allow-non-cta"),
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeName(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function toLines(value) {
  return Array.isArray(value) ? value : String(value || "").split(/\n+/);
}

function emphasize(rawText, accents = []) {
  let html = esc(rawText);
  const sorted = [...accents].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const accent of sorted) {
    const escaped = esc(accent);
    html = html.split(escaped).join(`<span class="accent">${escaped}</span>`);
  }
  return html;
}

function headlineHtml(card) {
  return toLines(card.headline)
    .filter((line) => line.trim())
    .map((line) => `<span>${emphasize(line, card.accent)}</span>`)
    .join("");
}

function bodyHtml(card) {
  if (!card.body) return "";
  return toLines(card.body)
    .filter((line) => line.trim())
    .map((line) => `<span>${emphasize(line, card.accent)}</span>`)
    .join("");
}

function validateTopic(topic, options) {
  const errors = [];
  if (!topic.project?.slug) errors.push("project.slug is required.");
  if (!Array.isArray(topic.media) || topic.media.length === 0) errors.push("media[] is required.");
  if (!Array.isArray(topic.cards) || topic.cards.length < 5) errors.push("cards[] needs at least 5 cards.");

  const mediaIds = new Set((topic.media || []).map((item) => item.id));
  for (const [index, card] of (topic.cards || []).entries()) {
    if (!card.type) errors.push(`cards[${index}].type is required.`);
    if (!card.headline) errors.push(`cards[${index}].headline is required.`);
    if (card.media && !mediaIds.has(card.media)) {
      errors.push(`cards[${index}].media "${card.media}" is not in media[].`);
    }
    if (Array.isArray(card.mediaGallery)) {
      for (const id of card.mediaGallery) {
        if (!mediaIds.has(id)) {
          errors.push(`cards[${index}].mediaGallery "${id}" is not in media[].`);
        }
      }
    }
  }

  if (!options.allowNonCta && topic.cards?.length >= 2) {
    const penultimate = topic.cards[topic.cards.length - 2];
    const final = topic.cards[topic.cards.length - 1];
    if (penultimate.type !== "pitchcheck") {
      errors.push('The penultimate card must use type "pitchcheck" for the feature CTA.');
    }
    if (final.type !== "cta") {
      errors.push('The final card must use type "cta" for the download/comment CTA.');
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

function extensionFromPath(value, fallback = ".jpg") {
  const ext = path.extname(new URL(value, "file:///").pathname).toLowerCase();
  return ext && ext.length <= 6 ? ext : fallback;
}

async function downloadToFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(targetPath, buffer);
}

function copyFonts(projectDir) {
  const srcDir = path.join(ROOT, "assets", "fonts", "gmarket");
  const dstDir = path.join(projectDir, "assets", "fonts", "gmarket");
  mkdirSync(dstDir, { recursive: true });

  const fonts = ["GmarketSansTTFBold.ttf", "GmarketSansTTFMedium.ttf", "GmarketSansTTFLight.ttf"];
  for (const font of fonts) {
    const src = path.join(srcDir, font);
    if (!existsSync(src)) {
      throw new Error(`Missing GmarketSans font: ${src}`);
    }
    copyFileSync(src, path.join(dstDir, font));
  }
}

function copyBrandAssets(projectDir) {
  const srcDir = path.join(ROOT, "assets", "brand");
  const dstDir = path.join(projectDir, "assets", "brand");
  mkdirSync(dstDir, { recursive: true });

  const files = ["pitchcheck-wordmark-horizontal.png", "pitchcheck-wordmark-mini.png"];
  for (const file of files) {
    const src = path.join(srcDir, file);
    if (!existsSync(src)) {
      throw new Error(`Missing PitchCheck brand asset: ${src}`);
    }
    copyFileSync(src, path.join(dstDir, file));
  }
}

async function prepareMedia(topic, topicPath, projectDir) {
  const topicDir = path.dirname(topicPath);
  const mediaDir = path.join(projectDir, "assets", "media");
  mkdirSync(mediaDir, { recursive: true });

  const map = new Map();
  for (const item of topic.media) {
    const id = safeName(item.id);
    const ext = item.path ? path.extname(item.path) || ".jpg" : extensionFromPath(item.url || "");
    const target = path.join(mediaDir, `${id}${ext}`);
    if (item.path) {
      const sourcePath = path.resolve(topicDir, item.path);
      if (!existsSync(sourcePath)) throw new Error(`Missing media path for "${item.id}": ${sourcePath}`);
      copyFileSync(sourcePath, target);
    } else if (item.url) {
      await downloadToFile(item.url, target);
    } else {
      throw new Error(`media "${item.id}" needs path or url.`);
    }

    map.set(item.id, {
      ...item,
      id,
      file: target,
      cardSrc: path.relative(path.join(projectDir, "cards"), target).replaceAll("\\", "/"),
      indexSrc: path.relative(projectDir, target).replaceAll("\\", "/"),
    });
  }
  return map;
}

function cardMedia(card, mediaMap) {
  if (!card.media) return "";
  const media = mediaMap.get(card.media);
  if (!media) return "";
  return `<img src="${esc(media.cardSrc)}" alt="${esc(media.alt || card.media)}" />`;
}

function galleryMedia(card, mediaMap) {
  const ids = Array.isArray(card.mediaGallery) ? card.mediaGallery : [];
  return ids.map((id) => mediaMap.get(id)).filter(Boolean);
}

function galleryHtml(card, mediaMap, className = "proof-gallery") {
  const items = galleryMedia(card, mediaMap);
  if (!items.length) return "";
  return `<div class="${className}">${items
    .map(
      (item, index) =>
        `<div class="proof-frame proof-frame-${index + 1}"><img src="${esc(item.cardSrc)}" alt="${esc(
          item.alt || item.id,
        )}" /></div>`,
    )
    .join("")}</div>`;
}

function cardSource(topic, card) {
  return esc(card.source || topic.project?.sourceLabel || "PitchCheck");
}

function labelHtml(card) {
  return card.label ? `<div class="copy-chip">${esc(card.label)}</div>` : "";
}

function sharedCss(topic) {
  const accent = topic.style?.accent || "#25d9a3";
  const accent2 = topic.style?.secondaryAccent || "#ffffff";
  return `
@font-face{font-family:"GmarketSans";src:url("../assets/fonts/gmarket/GmarketSansTTFLight.ttf") format("truetype");font-weight:300}
@font-face{font-family:"GmarketSans";src:url("../assets/fonts/gmarket/GmarketSansTTFMedium.ttf") format("truetype");font-weight:500}
@font-face{font-family:"GmarketSans";src:url("../assets/fonts/gmarket/GmarketSansTTFBold.ttf") format("truetype");font-weight:800}
:root{--accent:${accent};--accent2:${accent2};--black:#050607;--text:#fff;--muted:rgba(255,255,255,.72)}
*{box-sizing:border-box}html,body{width:${CARD_W}px;height:${CARD_H}px;margin:0;background:#000;overflow:hidden}
body{font-family:"GmarketSans",system-ui,sans-serif;color:var(--text);letter-spacing:0;-webkit-font-smoothing:antialiased}
.card{position:relative;width:${CARD_W}px;height:${CARD_H}px;overflow:hidden;background:#000}
.media-bg,.media-bg img{position:absolute;inset:0;width:100%;height:100%}
.media-bg img{object-fit:cover;filter:saturate(1.08) contrast(1.02)}
.dim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.22) 42%,rgba(0,0,0,.92) 100%)}
.dim-heavy{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18) 0%,rgba(0,0,0,.5) 45%,rgba(0,0,0,.96) 100%)}
.top-brand{position:absolute;z-index:18;left:72px;top:64px;display:flex;align-items:center}
.brand-lockup{height:58px;display:flex;align-items:center;padding:12px 17px 10px;border-radius:15px;background:rgba(255,255,255,.96);box-shadow:0 14px 42px rgba(0,0,0,.26)}
.brand-lockup img{height:35px;width:auto;display:block}
.copy{position:absolute;z-index:12;left:72px;right:72px;bottom:106px;min-height:330px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end}
.copy-chip{display:inline-flex;align-items:center;min-height:55px;max-width:880px;margin:0 0 18px;padding:13px 20px 10px;background:rgba(0,0,0,.86);font-size:30px;line-height:1.08;font-weight:800;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.28)}
.headline{max-width:940px;margin:0;display:flex;flex-direction:column;gap:9px;font-size:88px;line-height:1.05;font-weight:800;letter-spacing:0;text-shadow:0 8px 34px rgba(0,0,0,.7)}
.headline span{display:block}
.body{max-width:900px;display:flex;flex-direction:column;gap:8px;margin:24px 0 0;font-size:34px;line-height:1.28;font-weight:500;color:rgba(255,255,255,.86);text-shadow:0 5px 26px rgba(0,0,0,.76)}
.accent{color:var(--accent)}
.source{position:absolute;z-index:10;left:72px;bottom:82px;font-size:22px;font-weight:500;color:rgba(255,255,255,.56)}
.brand-footer{position:absolute;z-index:10;right:72px;bottom:46px;font-size:27px;font-weight:800;color:#fff}
.cover .copy{bottom:106px;min-height:380px}
.cover .headline{font-size:96px}
.story .copy,.stat .copy,.bridge .copy{bottom:116px;min-height:345px}
.story .headline,.stat .headline,.bridge .headline{font-size:80px}
.story .body,.stat .body,.bridge .body{font-size:33px;max-width:900px}
.stat-box{position:absolute;z-index:8;left:82px;right:82px;top:172px;padding:28px;border-radius:30px;background:rgba(0,0,0,.72);border:2px solid rgba(255,255,255,.28);backdrop-filter:blur(10px)}
.stat-box .row{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.18);padding:22px 10px;font-size:34px;font-weight:800}
.stat-box .row:last-child{border-bottom:0}.stat-box strong{color:var(--accent)}
.chat-bubbles{position:absolute;z-index:9;right:72px;top:346px;display:flex;flex-direction:column;gap:18px}
.bubble{max-width:560px;padding:20px 24px 18px;border-radius:20px;background:rgba(6,10,18,.9);border-left:7px solid var(--accent);font-size:32px;font-weight:800;box-shadow:0 18px 54px rgba(0,0,0,.38)}
.pitchcheck{background:radial-gradient(circle at 72% 20%,rgba(37,217,163,.24),transparent 36%),linear-gradient(180deg,#07100e,#000)}
.phone-shot{position:absolute;z-index:6;left:50%;top:105px;transform:translateX(-50%);width:590px;height:720px;display:flex;align-items:center;justify-content:center;border-radius:44px;background:rgba(255,255,255,.05);box-shadow:0 42px 120px rgba(37,217,163,.23)}
.phone-shot img{max-width:100%;max-height:100%;object-fit:contain;border-radius:38px}
.proof-gallery{position:absolute;z-index:6;left:56px;right:56px;top:98px;height:690px}
.proof-frame{position:absolute;overflow:hidden;border:2px solid rgba(255,255,255,.16);border-radius:34px;background:#050607;box-shadow:0 26px 82px rgba(0,0,0,.46)}
.proof-frame img{display:block;width:100%;height:100%;object-fit:cover}
.pitchcheck .proof-frame-1{left:0;top:70px;width:300px;height:590px;transform:rotate(-4deg)}
.pitchcheck .proof-frame-2{left:290px;top:0;width:360px;height:668px;z-index:2}
.pitchcheck .proof-frame-3{right:0;top:70px;width:300px;height:590px;transform:rotate(4deg)}
.pitchcheck .proof-frame-4{left:72px;top:452px;width:228px;height:210px;border-radius:26px}
.pitchcheck .proof-frame-5{right:74px;top:452px;width:228px;height:210px;border-radius:26px}
.pitchcheck .proof-frame-6{left:398px;top:496px;width:256px;height:162px;border-radius:25px}
.proof-badge{position:absolute;z-index:8;right:70px;top:780px;padding:15px 18px 12px;border-radius:999px;background:rgba(37,217,163,.95);color:#06100d;font-size:25px;font-weight:800;box-shadow:0 18px 42px rgba(37,217,163,.22)}
.pitchcheck .copy{bottom:120px;min-height:318px}.pitchcheck .headline{font-size:76px}.pitchcheck .body{font-size:31px;max-width:890px}
.cta{background:radial-gradient(circle at 50% 14%,rgba(37,217,163,.24),transparent 32%),linear-gradient(180deg,#06110e 0%,#000 76%)}
.cta-gallery{position:absolute;z-index:1;left:44px;right:44px;top:86px;height:560px;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:126px;gap:13px;opacity:.74}
.cta-gallery .proof-frame{position:relative;left:auto;right:auto;top:auto;width:auto;height:auto;transform:none;border-radius:22px;border-color:rgba(255,255,255,.16);box-shadow:0 18px 54px rgba(0,0,0,.28)}
.cta-gallery .proof-frame img{object-fit:cover}
.cta:before{content:"";position:absolute;z-index:3;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 0%,rgba(0,0,0,.34) 38%,rgba(0,0,0,.94) 73%,#000 100%)}
.cta-panel{position:absolute;z-index:8;left:86px;right:86px;top:248px;height:320px;border-radius:32px;border:2px solid rgba(255,255,255,.22);background:rgba(255,255,255,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 30px 100px rgba(0,0,0,.46)}
.cta-wordmark{height:76px;display:flex;align-items:center;justify-content:center;margin-bottom:18px}
.cta-wordmark img{height:64px;width:auto;display:block}
.cta-sub{font-size:30px;font-weight:800;color:#092017}
.cta-action{display:flex;align-items:center;gap:15px;margin-top:18px;padding:14px 22px 12px;border-radius:999px;background:#07100d;color:#fff;font-size:29px;font-weight:800}
.cta-action span{color:rgba(255,255,255,.66);font-size:22px}.cta-action strong{color:var(--accent);font-style:normal}
.cta-link-note{margin-top:12px;font-size:23px;line-height:1.1;font-weight:800;color:#24785f}
.cta .copy{left:86px;right:86px;bottom:112px;min-height:308px;text-align:center;align-items:center}.cta .copy-chip{align-self:center}.cta .headline{font-size:78px;line-height:1.07;max-width:900px}.cta .body{font-size:32px;max-width:880px;margin-left:auto;margin-right:auto}
.page{position:absolute;z-index:11;left:72px;bottom:46px;font-size:24px;color:rgba(255,255,255,.48)}
`.trim();
}

function statOverlay(card) {
  if (!Array.isArray(card.stats) || card.stats.length === 0) return "";
  const rows = card.stats
    .map((row) => `<div class="row"><span>${esc(row.label)}</span><strong>${esc(row.value)}</strong></div>`)
    .join("");
  return `<div class="stat-box">${rows}</div>`;
}

function bridgeOverlay(card) {
  if (card.type !== "bridge") return "";
  const bubbles = card.bubbles || ["거의 다 옴", "오늘 급한 일 생김", "혹시 한 명 더 구함?"];
  return `<div class="chat-bubbles">${bubbles.map((item) => `<div class="bubble">${esc(item)}</div>`).join("")}</div>`;
}

function cardHtml(topic, card, index, total, mediaMap) {
  const brand = topic.project?.brand || "PITCHCHECK";
  const logoText = topic.style?.logoText || "CHUK9 CHECK";
  const label = labelHtml(card);
  const page = `<div class="page">${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>`;
  const source = `<div class="source">Source · ${cardSource(topic, card)}</div>`;
  const footer = `<div class="brand-footer">${esc(brand)}</div>`;
  const topBrand = `<div class="top-brand"><span class="brand-dot">P</span><span>${esc(logoText)}</span></div>`;

  if (card.type === "cta") {
    const keyword = card.ctaKeyword || topic.project?.ctaKeyword || "피치체크";
    return htmlShell(topic, index, `
<article class="card cta">
  ${topBrand}
  <div class="cta-panel">
    <div class="app-icon">P</div>
    <div class="cta-logo">PITCHCHECK</div>
    <div class="cta-sub">총무가 편해야 팀이 오래갑니다</div>
    <div class="store-row"><span class="store">Google Play</span><span class="store">App Store</span></div>
  </div>
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body"><span>${emphasize(card.body || `댓글로 [${keyword}] 남겨주시면 링크를 보내드립니다.`, card.accent)}</span></p>
  </div>
  ${page}${footer}
</article>`);
  }

  if (card.type === "pitchcheck") {
    return htmlShell(topic, index, `
<article class="card pitchcheck">
  ${topBrand}
  <div class="phone-shot">${cardMedia(card, mediaMap)}</div>
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${bodyHtml(card)}</p>
  </div>
  ${page}${footer}${source}
</article>`);
  }

  const media = `<div class="media-bg">${cardMedia(card, mediaMap)}</div>`;
  const dim = card.type === "cover" ? '<div class="dim"></div>' : '<div class="dim-heavy"></div>';
  return htmlShell(topic, index, `
<article class="card ${esc(card.type)}">
  ${media}${dim}${topBrand}
  ${statOverlay(card)}
  ${bridgeOverlay(card)}
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${bodyHtml(card)}</p>
  </div>
  ${page}${footer}${source}
</article>`);
}

function cardHtmlV2(topic, card, index, total, mediaMap) {
  const brand = topic.project?.brand || "PITCHCHECK";
  const logoText = topic.style?.logoText || "PITCHCHECK";
  const label = labelHtml(card);
  const page = `<div class="page">${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>`;
  const source = `<div class="source">Source · ${cardSource(topic, card)}</div>`;
  const footer = `<div class="brand-footer">${esc(brand)}</div>`;
  const topBrand = `<div class="top-brand"><span class="brand-dot">P</span><span>${esc(logoText)}</span></div>`;

  if (card.type === "cta") {
    const keyword = card.ctaKeyword || topic.project?.ctaKeyword || "피치체크";
    const ctaGallery = galleryHtml(card, mediaMap, "cta-gallery");
    const ctaSub = card.ctaSub || "실제 사용 화면 기반으로 확인하세요";
    const ctaBody =
      card.body || `댓글로 [${keyword}] 남겨주시면 실제 화면과 다운로드 링크를 보내드릴게요.`;
    const ctaBodyHtml = toLines(ctaBody)
      .filter((line) => line.trim())
      .map((line) => `<span>${emphasize(line, card.accent)}</span>`)
      .join("");
    const ctaActionLabel = card.ctaActionLabel || "댓글 키워드";
    const ctaActionValue = card.ctaActionValue || `[${keyword}]`;
    const profileLinkNote = card.profileLinkNote
      ? `<div class="cta-link-note">${esc(card.profileLinkNote)}</div>`
      : "";
    return htmlShell(topic, index, `
<article class="card cta">
  ${topBrand}
  ${ctaGallery}
  <div class="cta-panel">
    <div class="app-icon">P</div>
    <div class="cta-logo">PITCHCHECK</div>
    <div class="cta-sub">${esc(ctaSub)}</div>
    <div class="cta-action"><span>${esc(ctaActionLabel)}</span><strong>${esc(ctaActionValue)}</strong></div>
    ${profileLinkNote}
  </div>
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${ctaBodyHtml}</p>
  </div>
  ${page}${footer}
</article>`);
  }

  if (card.type === "pitchcheck") {
    const gallery = galleryHtml(card, mediaMap, "proof-gallery");
    const visual = gallery
      ? `${gallery}<div class="proof-badge">${esc(card.proofBadge || "실제 화면")}</div>`
      : `<div class="phone-shot">${cardMedia(card, mediaMap)}</div>`;
    return htmlShell(topic, index, `
<article class="card pitchcheck">
  ${topBrand}
  ${visual}
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${bodyHtml(card)}</p>
  </div>
  ${page}${footer}
</article>`);
  }

  const media = `<div class="media-bg">${cardMedia(card, mediaMap)}</div>`;
  const dim = card.type === "cover" ? '<div class="dim"></div>' : '<div class="dim-heavy"></div>';
  return htmlShell(topic, index, `
<article class="card ${esc(card.type)}">
  ${media}${dim}${topBrand}
  ${statOverlay(card)}
  ${bridgeOverlay(card)}
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${bodyHtml(card)}</p>
  </div>
  ${page}${footer}${source}
</article>`);
}

function cardHtmlV3(topic, card, index, total, mediaMap) {
  const brand = topic.project?.brand || "PITCHCHECK";
  const label = labelHtml(card);
  const page = `<div class="page">${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>`;
  const source = `<div class="source">Source · ${cardSource(topic, card)}</div>`;
  const footer = `<div class="brand-footer">${esc(brand)}</div>`;
  const topBrand = `<div class="top-brand"><span class="brand-lockup"><img src="../assets/brand/pitchcheck-wordmark-horizontal.png" alt="PitchCheck" /></span></div>`;

  if (card.type === "cta") {
    const keyword = card.ctaKeyword || topic.project?.ctaKeyword || "피치체크";
    const ctaGallery = galleryHtml(card, mediaMap, "cta-gallery");
    const ctaSub = card.ctaSub || "실제 사용 화면 기반으로 확인하세요";
    const ctaBody =
      card.body || `댓글로 [${keyword}] 남겨주시면 실제 화면과 다운로드 링크를 보내드릴게요.`;
    const ctaBodyHtml = toLines(ctaBody)
      .filter((line) => line.trim())
      .map((line) => `<span>${emphasize(line, card.accent)}</span>`)
      .join("");
    const ctaActionLabel = card.ctaActionLabel || "댓글 키워드";
    const ctaActionValue = card.ctaActionValue || `[${keyword}]`;
    const profileLinkNote = card.profileLinkNote
      ? `<div class="cta-link-note">${esc(card.profileLinkNote)}</div>`
      : "";
    return htmlShell(topic, index, `
<article class="card cta">
  ${topBrand}
  ${ctaGallery}
  <div class="cta-panel">
    <div class="cta-wordmark"><img src="../assets/brand/pitchcheck-wordmark-horizontal.png" alt="PitchCheck" /></div>
    <div class="cta-sub">${esc(ctaSub)}</div>
    <div class="cta-action"><span>${esc(ctaActionLabel)}</span><strong>${esc(ctaActionValue)}</strong></div>
    ${profileLinkNote}
  </div>
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${ctaBodyHtml}</p>
  </div>
  ${page}${footer}
</article>`);
  }

  if (card.type === "pitchcheck") {
    const gallery = galleryHtml(card, mediaMap, "proof-gallery");
    const visual = gallery
      ? `${gallery}<div class="proof-badge">${esc(card.proofBadge || "실제 화면")}</div>`
      : `<div class="phone-shot">${cardMedia(card, mediaMap)}</div>`;
    return htmlShell(topic, index, `
<article class="card pitchcheck">
  ${topBrand}
  ${visual}
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${bodyHtml(card)}</p>
  </div>
  ${page}${footer}
</article>`);
  }

  const media = `<div class="media-bg">${cardMedia(card, mediaMap)}</div>`;
  const dim = card.type === "cover" ? '<div class="dim"></div>' : '<div class="dim-heavy"></div>';
  return htmlShell(topic, index, `
<article class="card ${esc(card.type)}">
  ${media}${dim}${topBrand}
  ${statOverlay(card)}
  ${bridgeOverlay(card)}
  <div class="copy">
    ${label}
    <h1 class="headline">${headlineHtml(card)}</h1>
    <p class="body">${bodyHtml(card)}</p>
  </div>
  ${page}${footer}${source}
</article>`);
}

function htmlShell(topic, index, body) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${CARD_W}, initial-scale=1" />
  <title>${esc(topic.project?.slug)} card ${index}</title>
  <link rel="stylesheet" href="./card-shared.css" />
</head>
<body>${body}</body>
</html>`;
}

function mdTable(rows) {
  return rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replaceAll("\n", "<br>")).join(" | ")} |`).join("\n");
}

function writeProjectDocs(topic, projectDir, mediaMap) {
  const mediaRows = [...mediaMap.values()].map((item) => [
    item.id,
    item.usage || "",
    item.credit || "",
    item.alt || "",
    path.relative(projectDir, item.file).replaceAll("\\", "/"),
  ]);

  const sourcePack = `# Source Pack\n\n## Topic\n\n${topic.project.title}\n\n## Sources\n\n${(topic.sources || [])
    .map((source) => `- ${source.label}${source.url ? `: ${source.url}` : ""}${source.note ? `\n  - Note: ${source.note}` : ""}`)
    .join("\n") || "- Source not provided."}\n\n## Media Ledger\n\n${mdTable([
    ["ID", "Usage", "Credit", "Alt", "Local File"],
    ...mediaRows,
  ])}\n\n## Search Intents\n\n${(topic.search || [])
    .map((item) => `- ${item.query}\n  - Purpose: ${item.purpose || ""}\n  - Preferred: ${(item.preferredSources || []).join(", ")}`)
    .join("\n") || "- No search intents recorded."}\n\n## Notes\n\n${topic.notes || ""}\n`;

  const storyboard = `# Storyboard\n\n${mdTable([
    ["Card", "Type", "Role", "Label", "Headline", "Body", "Media"],
    ...topic.cards.map((card, index) => [
      index + 1,
      card.type,
      card.role || "",
      card.label || "",
      toLines(card.headline).join("<br>"),
      card.body || "",
      card.media || "",
    ]),
  ])}\n\n## CTA Rule\n\n- Penultimate card: ${topic.cards[topic.cards.length - 2].type}\n- Final card: ${topic.cards[topic.cards.length - 1].type}\n`;

  const motionPlan = `# Motion Plan\n\nStatic renderer output is PNG-first.\n\nRecommended next motion layer:\n\n- Card 01: 3-4s hook zoom on football visual, headline reveal.\n- Card ${topic.cards.length - 1}: comment keyword pulse and app-store badge reveal.\n- Engine: HyperFrames or HTML/CSS frame renderer.\n\nMotion is intentionally separate so static carousel production stays cheap and repeatable.\n`;

  writeFileSync(path.join(projectDir, "source-pack.md"), sourcePack, "utf8");
  writeFileSync(path.join(projectDir, "storyboard.md"), storyboard, "utf8");
  writeFileSync(path.join(projectDir, "motion-plan.md"), motionPlan, "utf8");
  writeFileSync(path.join(projectDir, "caption.md"), `${topic.caption || ""}\n`, "utf8");
}

function indexHtml(topic, total) {
  const cards = Array.from({ length: total }, (_, idx) => {
    const n = String(idx + 1).padStart(2, "0");
    return `<section><h2>Card ${n}</h2><img src="./output/card-${n}.png" /></section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(topic.project.slug)}</title><style>
body{margin:0;padding:28px;background:#111;color:white;font-family:system-ui,sans-serif}
h1{font-size:30px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}
section{padding:14px;border:1px solid #333;border-radius:12px;background:#181818}h2{font-size:16px}
img{width:100%;border-radius:8px;display:block}
</style></head><body><h1>${esc(topic.project.title)}</h1><main>${cards}</main></body></html>`;
}

async function renderCards(projectDir, total) {
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--allow-file-access-from-files", "--disable-web-security", "--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
    for (let index = 1; index <= total; index += 1) {
      const n = String(index).padStart(2, "0");
      const htmlPath = path.join(projectDir, "cards", `card-${n}.html`);
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(projectDir, "output", `card-${n}.png`),
        type: "png",
        clip: { x: 0, y: 0, width: CARD_W, height: CARD_H },
      });
      console.log(`rendered card-${n}.png`);
    }
    await renderSheet(page, projectDir, total, "contact");
    await renderSheet(page, projectDir, total, "thumbnail");
  } finally {
    await browser.close();
  }
}

async function renderSheet(page, projectDir, total, mode) {
  const cols = mode === "contact" ? 4 : 7;
  const itemW = mode === "contact" ? 270 : 210;
  const itemH = mode === "contact" ? 338 : 210;
  const images = Array.from({ length: total }, (_, idx) => {
    const n = String(idx + 1).padStart(2, "0");
    const src = pathToFileURL(path.join(projectDir, "output", `card-${n}.png`)).href;
    return `<figure><div><img src="${src}" /></div><figcaption>${n}</figcaption></figure>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:36px;background:#111;color:#fff;font-family:Arial,sans-serif}
.grid{display:grid;grid-template-columns:repeat(${cols},${itemW}px);gap:24px}
figure{margin:0}figure div{width:${itemW}px;height:${itemH}px;overflow:hidden;background:#000;border-radius:10px}
img{width:100%;height:100%;object-fit:${mode === "contact" ? "contain" : "cover"}}
figcaption{text-align:center;margin-top:8px;color:#aaa;font-size:16px}
</style></head><body><div class="grid">${images}</div></body></html>`;

  await page.setViewport({ width: Math.max(1200, cols * (itemW + 24) + 72), height: 1200, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      }),
    );
  });
  await page.screenshot({
    path: path.join(projectDir, "output", `${mode}-sheet.png`),
    type: "png",
    fullPage: true,
  });
  console.log(`rendered ${mode}-sheet.png`);
  await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
}

async function buildProject(topic, topicPath, options) {
  const projectDir = path.join(options.outRoot, safeName(topic.project.slug));
  const cardsDir = path.join(projectDir, "cards");
  const outputDir = path.join(projectDir, "output");
  mkdirSync(cardsDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  copyFonts(projectDir);
  copyBrandAssets(projectDir);
  const mediaMap = await prepareMedia(topic, topicPath, projectDir);

  writeFileSync(path.join(cardsDir, "card-shared.css"), sharedCss(topic), "utf8");
  topic.cards.forEach((card, idx) => {
    const n = String(idx + 1).padStart(2, "0");
    writeFileSync(
      path.join(cardsDir, `card-${n}.html`),
      cardHtmlV3(topic, card, idx + 1, topic.cards.length, mediaMap),
      "utf8",
    );
  });

  writeProjectDocs(topic, projectDir, mediaMap);
  writeFileSync(path.join(projectDir, "index.html"), indexHtml(topic, topic.cards.length), "utf8");

  return projectDir;
}

async function main() {
  const options = parseArgs();
  const topic = readJson(options.input);
  validateTopic(topic, options);
  const projectDir = await buildProject(topic, options.input, options);

  if (options.dryRun) {
    console.log(`dry run ok: ${projectDir}`);
    return;
  }

  await renderCards(projectDir, topic.cards.length);
  console.log(`done: ${projectDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
