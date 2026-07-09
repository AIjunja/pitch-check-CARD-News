#!/usr/bin/env node

import { spawnSync } from "child_process";
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
const DEFAULT_BANK = path.join(ROOT, "samples", "pitchcheck", "story-bank-60.json");
const DEFAULT_IMAGE_REPORT = path.join(ROOT, "assets", "reference", "web", "football-story-bank-images.json");
const DEFAULT_OUT_DIR = path.join(ROOT, "samples", "pitchcheck", "generated");
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const BLOCKED_PRODUCT_FRAMES = new Set([
  "frame-003.jpg",
  "frame-015.jpg",
  "frame-016.jpg",
  "video-003",
  "video-015",
  "video-016",
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    bankPath: DEFAULT_BANK,
    imageReportPath: DEFAULT_IMAGE_REPORT,
    outDir: DEFAULT_OUT_DIR,
    topicId: null,
    index: 1,
    model: DEFAULT_MODEL,
    render: args.includes("--render"),
    package: args.includes("--package"),
    upload: args.includes("--upload"),
    forceFallback: args.includes("--no-gemini"),
    dryRunUpload: !args.includes("--real-upload"),
    temperature: 0.2,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--bank") opts.bankPath = path.resolve(ROOT, args[++i]);
    else if (arg === "--image-report") opts.imageReportPath = path.resolve(ROOT, args[++i]);
    else if (arg === "--out-dir") opts.outDir = path.resolve(ROOT, args[++i]);
    else if (arg === "--topic") opts.topicId = args[++i];
    else if (arg === "--index") opts.index = Number(args[++i]);
    else if (arg === "--model") opts.model = args[++i];
    else if (arg === "--temperature") opts.temperature = Number(args[++i]);
  }

  return opts;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeSlug(value) {
  return String(value || "pitchcheck-card")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w가-힣.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "pitchcheck-card";
}

function relFromOutput(outputFile, rootRelativePath) {
  return path.relative(path.dirname(outputFile), path.join(ROOT, rootRelativePath)).replaceAll("\\", "/");
}

function compactLine(value, max = 34) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd();
}

function toHeadlineLines(value, fallback) {
  const lines = Array.isArray(value) ? value : String(value || fallback || "").split(/\n+/);
  const clean = lines.map((line) => compactLine(line, 18)).filter(Boolean);
  if (clean.length >= 2) return clean.slice(0, 2);

  const text = clean[0] || compactLine(fallback || "축구 꿀잼 룰", 24);
  const midpoint = Math.ceil(text.length / 2);
  return [text.slice(0, midpoint).trim(), text.slice(midpoint).trim()].filter(Boolean).slice(0, 2);
}

function toBody(value, fallback) {
  const body = Array.isArray(value) ? value.join("\n") : String(value || fallback || "");
  return compactLine(body, 84);
}

function topicBySelector(bank, opts) {
  if (opts.topicId) {
    const found = bank.topics.find((topic) => topic.id === opts.topicId);
    if (!found) throw new Error(`Unknown story topic id: ${opts.topicId}`);
    return found;
  }
  const index = Math.max(1, Math.min(bank.topics.length, opts.index));
  return bank.topics[index - 1];
}

function getSourceUrls(bank, topic) {
  return (topic.sourceRefs || [])
    .map((ref) => ({ label: ref, url: bank.sourceRefs?.[ref] }))
    .filter((source) => source.url);
}

function maybeReadImageReport(file) {
  if (!existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function selectedImageForTopic(imageReport, topicId) {
  const item = imageReport?.topics?.find((topic) => topic.id === topicId);
  if (!item?.selected?.localPath) return null;
  const absolute = path.join(ROOT, item.selected.localPath);
  if (!existsSync(absolute)) return null;
  return {
    id: "story-cover",
    rootPath: item.selected.localPath,
    alt: item.selected.description || item.hook,
    credit: [item.selected.artist, item.selected.license].filter(Boolean).join(" / ") || "Wikimedia Commons candidate",
    usage: "story cards 1-5",
    sourcePage: item.selected.sourcePage,
  };
}

function walkImages(dir) {
  const result = [];
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkImages(full));
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      result.push(full);
    }
  }
  return result;
}

function discoverStoryMedia(topic, imageReport) {
  const media = [];
  const selected = selectedImageForTopic(imageReport, topic.id);
  if (selected) {
    media.push({ ...selected, id: "story-01", usage: "story card 1" });
  }

  const pool = storyFallbackPool();
  const start = stableIndex(`${topic.id}-${topic.hook}`, pool.length);
  for (let offset = 0; media.length < 5 && offset < pool.length; offset += 1) {
    const file = pool[(start + offset * 7) % pool.length];
    const rootPath = path.relative(ROOT, file).replaceAll("\\", "/");
    if (media.some((item) => item.rootPath === rootPath)) continue;
    media.push({
      id: `story-${String(media.length + 1).padStart(2, "0")}`,
      rootPath,
      alt: `${topic.visualNeed} reference ${media.length + 1}`,
      credit: "Local football reference / verify usage rights before final posting",
      usage: `story card ${media.length + 1}`,
    });
  }

  if (!media.length) {
    media.push({ ...fallbackStoryImage(), id: "story-01", usage: "story cards 1-5" });
  }

  return media;
}

function storyFallbackPool() {
  const roots = [
    path.join(ROOT, "assets", "images"),
    path.join(ROOT, "assets", "reference", "pitchcheck-local", "chuk9-card-refs"),
    path.join(ROOT, "assets", "reference", "pitchcheck-local", "chuk9-zip-extracted"),
  ];
  const blocked = [
    "dog",
    "puppy",
    "cat",
    "pet",
    "animal",
    "brand",
    "logo",
    "pitchcheck",
    "pitchcheck-video",
    "pitchcheck-screens",
    "dashboard",
    "ui",
    "screen",
    "app",
  ];
  return roots
    .flatMap(walkImages)
    .filter((file) => {
      const lower = file.toLowerCase();
      return statSync(file).size > 20_000 && !blocked.some((word) => lower.includes(word));
    })
    .sort();
}

function stableIndex(value, length) {
  if (!length) return 0;
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function discoverProductMedia() {
  const base = path.join(ROOT, "assets", "reference", "pitchcheck-local");
  const images = walkImages(base)
    .filter((file) => {
      const lower = file.toLowerCase();
      const name = path.basename(lower);
      if ([...BLOCKED_PRODUCT_FRAMES].some((blocked) => name.includes(blocked.toLowerCase()))) return false;
      if (lower.includes("chuk9-card-refs")) return false;
      if (lower.includes("brand")) return false;
      return lower.includes("pitchcheck-video") || lower.includes("pitchcheck-screens") || lower.includes("chuk9-zip-extracted");
    })
    .sort((a, b) => {
      const aw = scoreProductPath(a);
      const bw = scoreProductPath(b);
      if (bw !== aw) return bw - aw;
      return a.localeCompare(b);
    })
    .slice(0, 14);

  return images.map((file, index) => ({
    id: `product-${String(index + 1).padStart(2, "0")}`,
    rootPath: path.relative(ROOT, file).replaceAll("\\", "/"),
    alt: `PitchCheck app proof ${index + 1}`,
    credit: "Local PitchCheck media",
    usage: index < 6 ? "card 6 product proof" : "card 7 CTA proof",
  }));
}

function scoreProductPath(file) {
  const lower = file.toLowerCase();
  let score = 0;
  if (lower.includes("pitchcheck-video")) score += 40;
  if (lower.includes("pitchcheck-screens")) score += 35;
  if (lower.includes("chuk9-zip-extracted")) score += 18;
  if (lower.includes("frame-00") || lower.includes("frame-01")) score += 8;
  if (lower.includes("dog") || lower.includes("pet") || lower.includes("animal")) score -= 100;
  return score;
}

function fallbackCopy(topic) {
  return {
    cards: [
      {
        label: "축구 꿀잼 룰",
        headline: toHeadlineLines(topic.hook, topic.hook),
        body: topic.fact,
        accent: [firstKeyword(topic.hook), "진짜"],
      },
      {
        label: "이게 왜 되냐면",
        headline: ["룰북에는", "이렇게 적혀있음"],
        body: topic.fact,
        accent: ["룰북", "진짜"],
      },
      {
        label: "재밌는 포인트",
        headline: ["알고 보면", "장면이 다르게 보임"],
        body: topic.whyFun,
        accent: ["알고 보면", "다르게"],
      },
      {
        label: "동네축구 공감",
        headline: ["우리 팀도", "이런 확인 많죠"],
        body: "출석, 장소, 시간, 회비, 포지션까지. 축구는 뛰기 전 확인부터 경기입니다.",
        accent: ["확인", "경기"],
      },
      {
        label: "피치체크 연결",
        headline: ["작은 확인이", "팀 분위기를 바꿉니다"],
        body: topic.pitchCheckBridge,
        accent: ["확인", "팀 분위기"],
      },
      {
        label: "운영자 공감",
        headline: ["축구보다 힘든 건", "매주 확인하는 일"],
        body: "누가 오는지, 어디로 오는지, 몇 시까지 오는지. 운영자가 매번 묻다가 먼저 지칩니다.",
        accent: ["매주 확인", "운영자"],
      },
      {
        label: "지금 설치",
        headline: ["팀 운영 막고 있다면", "피치체크로 정리"],
        body: ["프로필 링크에서 설치하세요", "댓글 [피치체크] = 사용 영상"],
        accent: ["프로필 링크", "피치체크", "설치"],
      },
    ],
    caption:
      `${topic.hook}\n\n${topic.fact}\n\n이런 작은 확인들이 쌓여서 축구가 굴러갑니다. 팀 운영도 마찬가지예요. 피치체크는 출석, 일정, 위치 확인을 한 번에 정리하게 만드는 팀 운영 도구입니다.\n\n프로필 링크에서 설치하고, 댓글에 [피치체크] 남기면 사용 영상도 보내드릴게요.`,
  };
}

function firstKeyword(text) {
  return String(text || "")
    .replace(/[^\w가-힣\s]/g, "")
    .split(/\s+/)
    .find((part) => part.length >= 2) || "축구";
}

function buildGeminiPrompt(topic, sources) {
  return [
    "너는 한국 인스타그램 카드뉴스 카피라이터다.",
    "목표: 축구인이 넘기지 않고 보는 꿀잼/정보형 카드뉴스를 만든다.",
    "AIDA 구조를 지켜라. 1-5번은 축구 콘텐츠로 관심과 정보, 6번은 운영자 공감, 7번은 설치 CTA다.",
    "중요: 제공된 fact를 바꾸거나 과장하지 마라. 출처 밖의 새 사실을 만들지 마라.",
    "말투: 짧고 세게, 축구 커뮤니티에서 먹히게. 과한 광고 말투 금지.",
    "반환은 JSON만. 마크다운 금지.",
    "",
    "반환 스키마:",
    JSON.stringify(
      {
        cards: [
          {
            label: "string",
            headline: ["line1", "line2"],
            body: "string",
            accent: ["short keyword"],
          },
        ],
        caption: "string",
      },
      null,
      2,
    ),
    "",
    "cards는 반드시 7개.",
    "각 headline은 2줄, 각 줄 18자 안팎.",
    "body는 카드당 80자 이내.",
    "7번 body는 프로필 링크 설치와 댓글 [피치체크] 사용 영상 문구를 포함.",
    "",
    "소재:",
    JSON.stringify(
      {
        id: topic.id,
        category: topic.category,
        hook: topic.hook,
        fact: topic.fact,
        whyFun: topic.whyFun,
        pitchCheckBridge: topic.pitchCheckBridge,
        visualNeed: topic.visualNeed,
        motionIdea: topic.motionIdea,
        sources,
      },
      null,
      2,
    ),
  ].join("\n");
}

async function generateWithGemini(topic, sources, opts) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || opts.forceFallback) return null;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildGeminiPrompt(topic, sources) }],
      },
    ],
    generationConfig: {
      temperature: opts.temperature,
      topP: 0.8,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(`${GEMINI_ENDPOINT}/models/${opts.model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API failed: HTTP ${response.status}\n${text}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "";
  if (!text.trim()) throw new Error("Gemini returned empty content.");
  return JSON.parse(text);
}

function normalizeCopy(copy, topic) {
  const fallback = fallbackCopy(topic);
  const sourceCards = Array.isArray(copy?.cards) && copy.cards.length >= 7 ? copy.cards : fallback.cards;
  const cards = fallback.cards.map((base, index) => {
    const item = sourceCards[index] || {};
    return {
      label: compactLine(item.label || base.label, 16),
      headline: toHeadlineLines(item.headline, base.headline),
      body: Array.isArray(base.body)
        ? toBody(item.body, base.body.join("\n")).split(/\n+/).filter(Boolean)
        : toBody(item.body, base.body),
      accent: Array.isArray(item.accent) && item.accent.length ? item.accent.slice(0, 4) : base.accent,
    };
  });

  return {
    cards,
    caption: String(copy?.caption || fallback.caption).trim(),
  };
}

function buildRendererTopic(bank, storyTopic, copy, outputFile, imageReport, geminiMeta) {
  const sources = getSourceUrls(bank, storyTopic);
  const storyMedia = discoverStoryMedia(storyTopic, imageReport);
  const productMedia = discoverProductMedia();
  const media = [...storyMedia, ...productMedia].map((item) => ({
    id: item.id,
    path: relFromOutput(outputFile, item.rootPath),
    alt: item.alt,
    credit: item.credit,
    usage: item.usage,
  }));

  const productIds = productMedia.map((item) => item.id);
  const proofGallery = productIds.slice(0, 6);
  const ctaGallery = productIds.slice(0, 12);

  const slug = `gemini-${storyTopic.id}`;
  const cardTypes = ["cover", "stat", "story", "bridge", "story", "pitchcheck", "cta"];
  const roles = ["attention", "interest", "interest", "desire", "bridge", "desire-empathy", "final-cta"];
  const sourceLabel = sources.map((source) => source.label).join(", ") || "PitchCheck story bank";

  return {
    project: {
      slug,
      title: `피치체크 축구 꿀잼 카드뉴스 - ${storyTopic.hook}`,
      channel: "피치체크",
      brand: "PITCHCHECK",
      ratio: "4:5",
      sourceLabel,
      ctaKeyword: "피치체크",
      generator: geminiMeta,
    },
    style: {
      template: "chuk9-editorial-real-cta",
      accent: "#25d9a3",
      secondaryAccent: "#ffffff",
      logoText: "PITCHCHECK",
    },
    sources: [
      ...sources.map((source) => ({
        label: source.label,
        url: source.url,
        note: "Story-bank fact source.",
      })),
      {
        label: "Local PitchCheck media",
        note: "Local app screenshots and usage-video frames are used for cards 6-7.",
      },
      ...(storyMedia[0]?.sourcePage
        ? [
            {
              label: "Selected Wikimedia Commons image candidate",
              url: storyMedia[0].sourcePage,
              note: storyMedia[0].credit,
            },
          ]
        : []),
    ],
    search: [
      {
        query: storyTopic.imageQueries?.join(" / ") || storyTopic.visualNeed,
        purpose: "Dynamic football story image candidates for cards 1-5.",
        preferredSources: ["Wikimedia Commons", "official source media", "licensed editorial assets"],
      },
    ],
    media,
    cards: copy.cards.map((card, index) => {
      const base = {
        type: cardTypes[index],
        role: roles[index],
        label: card.label,
        headline: card.headline,
        body: card.body,
        accent: card.accent,
        source: index < 5 ? sourceLabel : "PitchCheck local media",
      };

      if (index < 5) return { ...base, media: storyMedia[index % storyMedia.length].id };
      if (index === 5) {
        return {
          ...base,
          mediaGallery: proofGallery,
          proofBadge: "실제 피치체크 화면",
        };
      }
      return {
        ...base,
        mediaGallery: ctaGallery,
        ctaSub: "출석 · 일정 · 위치 체크를 한 곳에서",
        ctaActionLabel: "프로필 링크",
        ctaActionValue: "바로 설치",
        profileLinkNote: "댓글 [피치체크] = 사용 영상 보내드림",
        ctaKeyword: "피치체크",
      };
    }),
    caption: copy.caption,
    notes:
      "Generated from samples/pitchcheck/story-bank-60.json. Gemini only writes bounded copy; layout, CTA order, media selection, and rendering are deterministic code paths.",
  };
}

function fallbackStoryImage() {
  const fallback = path.join(ROOT, "assets", "reference", "pitchcheck-local", "chuk9-card-refs", "chuk9__check_DagGHz6kj8_.jpg");
  if (existsSync(fallback)) {
    return {
      id: "story-cover",
      rootPath: path.relative(ROOT, fallback).replaceAll("\\", "/"),
      alt: "football story reference",
      credit: "Local football reference",
      usage: "story cards 1-5",
    };
  }

  const candidates = walkImages(path.join(ROOT, "assets", "images"))
    .filter((file) => statSync(file).size > 0)
    .sort();
  if (candidates[0]) {
    return {
      id: "story-cover",
      rootPath: path.relative(ROOT, candidates[0]).replaceAll("\\", "/"),
      alt: "football story reference",
      credit: "Repository football reference",
      usage: "story cards 1-5",
    };
  }

  throw new Error("No story image found. Run npm run images:pitchcheck-story-bank or add assets/images.");
}

function runNode(args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function projectDirForTopic(rendererTopic) {
  return path.join(ROOT, "projects", safeSlug(rendererTopic.project.slug));
}

async function main() {
  const opts = parseArgs();
  const bank = readJson(opts.bankPath);
  const storyTopic = topicBySelector(bank, opts);
  const imageReport = maybeReadImageReport(opts.imageReportPath);

  let geminiCopy = null;
  let generator = {
    provider: "deterministic-fallback",
    model: "none",
    reason: "No Gemini API key or --no-gemini was used.",
  };

  if (!opts.forceFallback) {
    try {
      geminiCopy = await generateWithGemini(storyTopic, getSourceUrls(bank, storyTopic), opts);
      if (geminiCopy) {
        generator = {
          provider: "google-gemini",
          model: opts.model,
          temperature: opts.temperature,
        };
      }
    } catch (error) {
      console.warn(`Gemini generation failed; using fallback copy.\n${error.message}`);
      generator = {
        provider: "deterministic-fallback",
        model: opts.model,
        reason: error.message,
      };
    }
  }

  const copy = normalizeCopy(geminiCopy, storyTopic);
  const filename = `${safeSlug(storyTopic.id)}-${safeSlug(storyTopic.hook).slice(0, 42)}.json`;
  const outputFile = path.join(opts.outDir, filename);
  const rendererTopic = buildRendererTopic(bank, storyTopic, copy, outputFile, imageReport, generator);
  writeJson(outputFile, rendererTopic);

  console.log(`Generated topic JSON: ${path.relative(ROOT, outputFile)}`);
  console.log(`Generator: ${generator.provider}${generator.model ? ` / ${generator.model}` : ""}`);

  if (opts.render) {
    runNode(["scripts/pitchcheck/render-carousel.mjs", path.relative(ROOT, outputFile)], "render carousel");
  }

  let manifestPath = null;
  if (opts.package) {
    runNode(["scripts/pitchcheck/prepare-upload-package.mjs", path.relative(ROOT, outputFile)], "prepare upload package");
    manifestPath = path.join(ROOT, "dist", "uploads", safeSlug(rendererTopic.project.slug), "upload-manifest.json");
  }

  if (opts.upload) {
    if (!manifestPath) {
      manifestPath = path.join(ROOT, "dist", "uploads", safeSlug(rendererTopic.project.slug), "upload-manifest.json");
    }
    const args = ["scripts/pitchcheck/upload-package.mjs", path.relative(ROOT, manifestPath)];
    if (opts.dryRunUpload) args.push("--dry-run");
    runNode(args, "upload package");
  }

  console.log(`Done: ${path.relative(ROOT, outputFile)}`);
  if (opts.render) console.log(`Rendered project: ${path.relative(ROOT, projectDirForTopic(rendererTopic))}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
