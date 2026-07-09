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
const DEFAULT_BANK = path.join(ROOT, "samples", "pitchcheck", "viral-story-bank-60.json");
const DEFAULT_IMAGE_REPORT = path.join(ROOT, "assets", "reference", "web", "football-story-bank-images.json");
const DEFAULT_OUT_DIR = path.join(ROOT, "samples", "pitchcheck", "generated");
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const BLOCKED_PRODUCT_FRAMES = new Set([
  "frame-001.jpg",
  "frame-002.jpg",
  "frame-003.jpg",
  "frame-004.jpg",
  "frame-016.jpg",
  "frame-017.jpg",
  "video-001",
  "video-002",
  "video-003",
  "video-004",
  "video-016",
  "video-017",
]);

const CARD6_PRODUCT_FRAME_PRIORITY = [
  "frame-009.jpg",
  "frame-010.jpg",
  "frame-012.jpg",
  "frame-014.jpg",
  "frame-020.jpg",
  "frame-027.jpg",
  "frame-029.jpg",
  "frame-022.jpg",
];

const CARD7_PRODUCT_FRAME_PRIORITY = [
  ...CARD6_PRODUCT_FRAME_PRIORITY,
  "frame-005.jpg",
  "frame-006.jpg",
  "frame-007.jpg",
  "frame-008.jpg",
  "frame-011.jpg",
  "frame-013.jpg",
  "frame-015.jpg",
  "frame-018.jpg",
  "frame-021.jpg",
  "frame-023.jpg",
  "frame-024.jpg",
  "frame-025.jpg",
  "frame-026.jpg",
  "frame-028.jpg",
];

const STORY_MEDIA_OVERRIDES = {
  "fun-017": [
    "assets/images/topic-08/cover.jpg",
    "assets/images/topic-17/detail_03.jpg",
    "assets/images/topic-04/detail_02.jpg",
    "assets/images/topic-06/detail_01.jpg",
    "assets/images/topic-17/detail_01.jpg",
  ],
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    bankPath: DEFAULT_BANK,
    imageReportPath: DEFAULT_IMAGE_REPORT,
    outDir: DEFAULT_OUT_DIR,
    topicId: null,
    index: 1,
    indexProvided: false,
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
    else if (arg === "--index") {
      opts.index = Number(args[++i]);
      opts.indexProvided = true;
    }
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

function cleanCopy(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function splitLongKoreanToken(token, max) {
  if (token.length <= max) return [token];
  const breakMarks = ["하면", "라면", "부터", "까지", "에도", "으로", "에서", "처럼", "보다", "인데", "지만"];
  for (const mark of breakMarks) {
    const index = token.indexOf(mark);
    const splitAt = index >= 4 ? index + mark.length : -1;
    if (splitAt > 3 && token.length - splitAt > 3 && splitAt <= max + 2) {
      return [token.slice(0, splitAt), token.slice(splitAt)];
    }
  }
  return [token];
}

function wordWrap(text, max = 12) {
  const words = cleanCopy(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = "";
  for (const rawWord of words) {
    const pieces = splitLongKoreanToken(rawWord, max);
    for (const word of pieces) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= max || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function rebalanceTwoLines(lines, max = 12) {
  const clean = lines.map(cleanCopy).filter(Boolean);
  if (clean.length <= 2 && clean.every((line) => line.length <= max + 3)) return clean;

  const text = clean.join(" ");
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return clean.slice(0, 2);

  let best = null;
  for (let split = 1; split < words.length; split += 1) {
    const left = words.slice(0, split).join(" ");
    const right = words.slice(split).join(" ");
    if (left.length < 4 || right.length < 4) continue;
    const longest = Math.max(left.length, right.length);
    const balance = Math.abs(left.length - right.length);
    const score = longest * 2 + balance;
    if (!best || score < best.score) best = { lines: [left, right], score };
  }
  return best?.lines || clean.slice(0, 2);
}

function toHeadlineLines(value, fallback, max = 12) {
  if (Array.isArray(value)) {
    const manualLines = value.map(cleanCopy).filter(Boolean);
    if (manualLines.length) {
      const wrappedManual = manualLines.flatMap((line) => wordWrap(line, max));
      if (wrappedManual.length <= 2) return wrappedManual;
      return rebalanceTwoLines(wrappedManual, max).slice(0, 2);
    }
  }

  const fallbackText = Array.isArray(fallback) ? fallback.join(" ") : fallback;
  const raw = cleanCopy(value || fallbackText || "");
  const wrapped = wordWrap(raw, max);
  const balanced = rebalanceTwoLines(wrapped.length ? wrapped : wordWrap(fallbackText || "축구 꿀잼 룰", max), max);
  return balanced.slice(0, 2);
}

function toBody(value, fallback) {
  const body = Array.isArray(value) ? value.join("\n") : String(value || fallback || "");
  return compactLine(cleanCopy(body), 92);
}

function toBodyLines(value, fallback) {
  const rawLines = Array.isArray(value)
    ? value
    : Array.isArray(fallback)
      ? fallback
      : String(value || fallback || "").split(/\n+/);
  return rawLines
    .map((line) => compactLine(cleanCopy(line), 46))
    .filter(Boolean)
    .slice(0, 3);
}

function topicBySelector(bank, opts) {
  if (opts.topicId) {
    const found = bank.topics.find((topic) => topic.id === opts.topicId);
    if (!found) throw new Error(`Unknown story topic id: ${opts.topicId}`);
    return found;
  }
  if (!opts.indexProvided && bank.project?.defaultTopicId) {
    const found = bank.topics.find((topic) => topic.id === bank.project.defaultTopicId);
    if (found) return found;
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

function selectedImagesForTopic(imageReport, topic) {
  const item = imageReport?.topics?.find((candidate) => candidate.id === topic.id);
  const candidates = [item?.selected, ...(item?.selectedAlternates || [])].filter((candidate) => candidate?.localPath);
  return candidates
    .filter((candidate) => existsSync(path.join(ROOT, candidate.localPath)))
    .map((candidate, index) => ({
      id: `story-${String(index + 1).padStart(2, "0")}`,
      rootPath: candidate.localPath,
      alt: candidate.description || topic.visualNeed || topic.hook,
      credit: [candidate.artist, candidate.license].filter(Boolean).join(" / ") || "Wikimedia Commons candidate",
      usage: `story card ${index + 1}`,
      sourcePage: candidate.sourcePage,
    }));
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
  const override = explicitStoryMedia(topic);
  if (override.length) return override;

  const media = selectedImagesForTopic(imageReport, topic);
  if (topic.pillar && media.length) {
    const original = [...media];
    for (let index = media.length; media.length < 5; index += 1) {
      const source = original[index % original.length];
      media.push({
        ...source,
        id: `story-${String(media.length + 1).padStart(2, "0")}`,
        usage: `story card ${media.length + 1}`,
      });
    }
    return media;
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

function explicitStoryMedia(topic) {
  const files = STORY_MEDIA_OVERRIDES[topic.id] || [];
  return files
    .filter((rootPath) => existsSync(path.join(ROOT, rootPath)))
    .map((rootPath, index) => ({
      id: `story-${String(index + 1).padStart(2, "0")}`,
      rootPath,
      alt: `${topic.visualNeed} curated reference ${index + 1}`,
      credit: "Curated local football reference / verify usage rights before final posting",
      usage: `story card ${index + 1}`,
    }));
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
  const candidates = walkImages(base)
    .filter((file) => {
      const lower = file.toLowerCase();
      const name = path.basename(lower);
      if ([...BLOCKED_PRODUCT_FRAMES].some((blocked) => name.includes(blocked.toLowerCase()))) return false;
      if (lower.includes("brand")) return false;
      return lower.includes("pitchcheck-video") || lower.includes("pitchcheck-screens");
    })
    .sort((a, b) => a.localeCompare(b));

  const proofFiles = sortProductCandidates(candidates, CARD6_PRODUCT_FRAME_PRIORITY).slice(0, 6);
  const ctaFiles = sortProductCandidates(candidates, CARD7_PRODUCT_FRAME_PRIORITY).slice(0, 12);
  const images = uniqueFiles([...proofFiles, ...ctaFiles]).slice(0, 14);

  return images.map((file, index) => ({
    id: `product-${String(index + 1).padStart(2, "0")}`,
    rootPath: path.relative(ROOT, file).replaceAll("\\", "/"),
    alt: `PitchCheck app proof ${index + 1}`,
    credit: "Local PitchCheck media",
    usage: proofFiles.includes(file) ? "card 6 operations proof" : "card 7 CTA proof",
  }));
}

function uniqueFiles(files) {
  return [...new Set(files)];
}

function sortProductCandidates(files, preferredFrameNames) {
  const preferred = new Map(preferredFrameNames.map((name, index) => [name.toLowerCase(), index]));
  return [...files].sort((a, b) => {
    const aName = path.basename(a).toLowerCase();
    const bName = path.basename(b).toLowerCase();
    const aRank = preferred.has(aName) ? preferred.get(aName) : Number.MAX_SAFE_INTEGER;
    const bRank = preferred.has(bName) ? preferred.get(bName) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;

    const aw = scoreProductPath(a);
    const bw = scoreProductPath(b);
    if (bw !== aw) return bw - aw;
    return a.localeCompare(b);
  });
}

function scoreProductPath(file) {
  const lower = file.toLowerCase();
  let score = 0;
  if (lower.includes("pitchcheck-video")) score += 50;
  if (lower.includes("pitchcheck-screens")) score += 12;
  if (lower.includes("frame-009") || lower.includes("frame-010") || lower.includes("frame-012")) score += 18;
  if (lower.includes("frame-020") || lower.includes("frame-027") || lower.includes("frame-029")) score += 16;
  if (lower.includes("dog") || lower.includes("pet") || lower.includes("animal")) score -= 100;
  return score;
}

const RELATABLE_COPY_OVERRIDES = {
  "fun-017": {
    cards: [
      {
        label: "주장 현실",
        headline: ["완장 찼다고", "권한 생기는 거 아님"],
        body: "IFAB 기준으로도 주장은 특별한 지위나 특권이 없습니다.",
        accent: ["권한", "아님"],
      },
      {
        label: "룰북 반전",
        headline: ["있는 건 특권보다", "팀 행동 책임"],
        body: "완장은 필요하지만, 경기 중 팀 행동에 책임을 지는 쪽에 가깝습니다.",
        accent: ["책임"],
      },
      {
        label: "동호회 번역",
        headline: ["근데 현실은", "단톡 담당자"],
        body: "장소 어디예요, 몇 시예요, 저 늦어요. 질문은 거의 주장한테 옵니다.",
        accent: ["현실", "단톡"],
      },
      {
        label: "제일 빡센 순간",
        headline: ["경기 2시간 전", "답 안 한 사람"],
        body: "한 명만 확인 안 해도 인원, 포지션, 회비 계산이 다 흔들려요.",
        accent: ["2시간 전", "답 안 한"],
      },
      {
        label: "그래서",
        headline: ["주장이 아니라", "시스템이 물어야 함"],
        body: "출석, 일정, 위치를 앱에 남기면 같은 질문을 덜 반복합니다.",
        accent: ["시스템", "덜 반복"],
      },
      {
        label: "피치체크",
        headline: ["확인은 단톡 말고", "피치체크에 남겨요"],
        body: "누가 오는지, 어디로 오는지, 몇 시까지 오는지. 한 화면에서 확인하세요.",
        accent: ["피치체크", "확인"],
      },
      {
        label: "지금 설치",
        headline: ["팀 운영 맡았다면", "이건 깔아두세요"],
        body: ["프로필 링크에서 설치하세요.", "댓글 [피치체크] 남기면", "사용 영상도 보내드려요."],
        accent: ["프로필 링크", "피치체크", "설치"],
      },
    ],
    caption:
      "주장 완장 차면 권한보다 연락이 먼저 옵니다.\n\n재밌는 건, 룰북 기준으로도 주장은 특별한 특권이 있는 사람이 아닙니다. 오히려 팀 행동에 책임을 지는 쪽에 가깝죠.\n\n근데 동호회 축구에서는 장소 어디냐, 몇 시냐, 누가 오냐, 회비 냈냐까지 거의 주장/총무에게 몰립니다. 한 명만 답이 없어도 경기 전부터 머리가 아파요.\n\n피치체크는 출석, 일정, 위치 확인을 한 곳에서 정리하는 팀 운영 도구입니다.\n\n프로필 링크에서 설치하고, 댓글에 [피치체크] 남기면 사용 영상도 보내드려요.",
  },
};

const EARLY_AD_TERMS = [
  "피치체크",
  "PITCHCHECK",
  "PitchCheck",
  "설치",
  "앱",
  "프로필 링크",
  "댓글 [피치체크]",
  "사용 영상",
  "다운로드",
  "CTA",
  "출석 관리",
  "일정 관리",
  "운영 도구",
];

function hasEarlyAdSmell(card) {
  const text = [
    card?.label,
    ...(Array.isArray(card?.headline) ? card.headline : [card?.headline]),
    ...(Array.isArray(card?.body) ? card.body : [card?.body]),
    ...(Array.isArray(card?.accent) ? card.accent : []),
  ]
    .filter(Boolean)
    .join(" ");
  return EARLY_AD_TERMS.some((term) => text.includes(term));
}

function viralFallbackCopy(topic) {
  const reveal = cleanCopy(topic.fact || "이 축구 이야기는 출처 확인이 필요한 바이럴 소재입니다.");
  const fun = cleanCopy(topic.whyFun || "친구에게 보내기 좋은 축구 이야기라 저장과 댓글을 만들기 쉽습니다.");
  const share = cleanCopy(topic.shareTrigger || "이거 아는 친구 태그하고 반응을 보면 됩니다.");
  const bridge = cleanCopy(
    topic.pitchCheckBridge || "축구 얘기가 단톡을 살리듯, 팀 공지도 한 곳에 모이면 덜 피곤합니다.",
  );
  const card1 = topic.curiosityQuestion || topic.hook;

  return {
    cards: [
      {
        label: "알고 있었음?",
        headline: topic.coverHeadline || toHeadlineLines(card1, topic.hook, 12),
        body: "정답은 바로 말하지 말고, 다음 장에서 확인해보세요.",
        accent: [firstKeyword(topic.hook), "진짜"],
      },
      {
        label: topic.pillar === "ranking_comparison" ? "비교 포인트" : "숨은 이야기",
        headline: topic.teaseHeadline || toHeadlineLines(topic.hook, topic.hook, 12),
        body: compactLine(fun, 82),
        accent: ["왜", "반전"],
      },
      {
        label: "정답 공개",
        headline: topic.revealHeadline || ["진짜 포인트는", "여기에 있어요"],
        body: compactLine(reveal, 88),
        accent: ["진짜", "포인트"],
      },
      {
        label: "친구한테 보내기",
        headline: topic.shareHeadline || ["이건 단톡에", "던지기 좋다"],
        body: compactLine(share, 76),
        accent: ["단톡", "친구"],
      },
      {
        label: "댓글 유도",
        headline: topic.engagementHeadline || ["너라면 누구", "태그할래?"],
        body: "아는 친구 태그하고, 댓글로 본인 팀 얘기도 남겨보세요.",
        accent: ["태그", "댓글"],
      },
      {
        label: "우리 팀 현실",
        headline: topic.softBridgeHeadline || ["축구 얘기는 재밌는데", "공지 확인은 피곤함"],
        body: compactLine(bridge, 88),
        accent: ["공지", "확인"],
      },
      {
        label: "피치체크",
        headline: topic.ctaHeadline || ["팀 운영 맡았다면", "이건 깔아두세요"],
        body: ["프로필 링크 참고하세요.", "댓글 [피치체크] 남기면", "사용 영상도 보내드려요."],
        accent: ["프로필 링크", "피치체크", "사용 영상"],
      },
    ],
    caption: `${topic.hook}\n\n${reveal}\n\n${fun}\n\n${share}\n\n축구 얘기는 재밌게 나누고, 반복되는 팀 공지는 덜 피곤하게 정리하세요.\n\n프로필 링크 참고하고, 댓글에 [피치체크] 남기면 사용 영상도 보내드려요.`,
  };
}

function fallbackCopy(topic) {
  const override = RELATABLE_COPY_OVERRIDES[topic.id];
  if (override) return override;
  if (topic.pillar) return viralFallbackCopy(topic);

  const hookLines = toHeadlineLines(topic.hook, topic.hook, 12);
  return {
    cards: [
      {
        label: "축구 룰",
        headline: hookLines,
        body: topic.fact,
        accent: [firstKeyword(topic.hook), "인정"],
      },
      {
        label: "룰북 기준",
        headline: ["헷갈려도", "룰은 단순해요"],
        body: topic.fact,
        accent: ["룰", "단순"],
      },
      {
        label: "재밌는 포인트",
        headline: ["알고 보면", "장면이 다르게 보여요"],
        body: topic.whyFun,
        accent: ["알고 보면", "다르게"],
      },
      {
        label: "조기축구 공감",
        headline: ["우리 팀도", "매주 확인하죠"],
        body: "누가 오는지, 어디로 오는지, 몇 시까지 오는지. 경기 전 확인할 게 많아요.",
        accent: ["매주", "확인"],
      },
      {
        label: "피치체크 연결",
        headline: ["확인이 줄면", "팀이 덜 흔들려요"],
        body: topic.pitchCheckBridge,
        accent: ["확인", "팀"],
      },
      {
        label: "운영자 공감",
        headline: ["매주 묻는 일", "그게 제일 힘들죠"],
        body: "출석, 일정, 위치 확인을 매번 손으로 하면 경기 전부터 지쳐요.",
        accent: ["매주", "확인"],
      },
      {
        label: "지금 설치",
        headline: ["팀 운영이 막히면", "피치체크로 정리"],
        body: ["프로필 링크에서 설치하세요.", "댓글 [피치체크] 남기면", "사용 영상도 보내드려요."],
        accent: ["프로필 링크", "피치체크", "설치"],
      },
    ],
    caption:
      `${topic.hook}\n\n${topic.fact}\n\n재밌는 룰 하나 알고 보는 것도 좋지만, 우리 팀 경기는 매주 확인할 게 더 많죠. 누가 오는지, 어디로 오는지, 몇 시까지 오는지. 이걸 매번 손으로 하면 운영자가 먼저 지쳐요.\n\n피치체크는 출석, 일정, 위치 확인을 한 곳에서 정리하는 팀 운영 도구입니다.\n\n프로필 링크에서 설치하고, 댓글에 [피치체크] 남기면 사용 영상도 보내드려요.`,
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
    "너는 한국 축구 인스타그램 카드뉴스 기획자이자 UX 카피라이터다.",
    "이번 작업의 목표는 광고가 아니다. 축구 팬이 자연스럽게 넘기고, 저장하고, 친구에게 보내는 바이럴 카드뉴스를 만든다.",
    "피치체크는 앞에서 팔지 않는다. 1~5번은 순수 축구 썰/기록/비교/공감 콘텐츠여야 한다.",
    "AIDA 구조: 1 Attention, 2 Interest, 3 Reveal, 4 Desire/Share, 5 Engagement, 6 Soft bridge, 7 CTA.",
    "",
    "레퍼런스에서 반영할 원칙:",
    "- 썸네일/1장은 답을 공개하지 않는다. 질문, 의아함, 친구 태그 욕구를 만든다.",
    "- SNS 카피는 모두가 아니라 한 명에게 쓴다. 독자 한 명, 상황 하나, 행동 하나가 선명해야 한다.",
    "- 카피는 담백하되 귀에 걸려야 한다. 설명보다 '이거 친구한테 보내고 싶다'가 먼저다.",
    "- 토스 UX Writing처럼 쓴다. 짧고, 바로 이해되고, 다음 행동이 선명해야 한다.",
    "",
    "절대 금지:",
    "- 카드 1~5에 피치체크, PitchCheck, 앱, 설치, 프로필 링크, 댓글 [피치체크], 사용 영상, CTA, 운영 도구를 쓰지 마라.",
    "- 카드 6에 '실제 화면', '기능 소개', '다운로드하세요' 같은 광고 설명을 쓰지 마라.",
    "- 카드 1에서 정답을 공개하지 마라.",
    "- 출처에 없는 사실, 루머, 과장된 단정, 최신 이적료 1위 같은 불확실한 현재형 주장을 만들지 마라.",
    "- 보고서체, 번역체, 마케팅 문구, 추상어를 쓰지 마라. '운영 효율' 대신 '누가 오는지 매번 묻는 일'처럼 쓴다.",
    "- headline 줄바꿈에서 조사나 2~3글자 단어를 혼자 남기지 마라.",
    "",
    "카드별 역할:",
    "1. 궁금증 유발 제목. 답은 숨긴다. 축구 팬이 멈출 질문으로 쓴다.",
    "2. 왜 궁금한지 상황을 키운다. 아직 정답을 다 말하지 않는다.",
    "3. fact 공개. 제공된 fact만 사용한다.",
    "4. 왜 재밌는지, 왜 공유할 만한지 팬 말투로 번역한다.",
    "5. 댓글/친구 태그/저장 이유를 만든다. 제품 언급 금지.",
    "6. 축구 단톡/팀 운영 공감으로 부드럽게 잇는다. 제품 기능 나열 금지.",
    "7. 여기서만 피치체크 CTA. 프로필 링크 참고 + 댓글 [피치체크] 남기면 사용 영상 안내.",
    "",
    "말투:",
    "- 축구 커뮤니티에서 바로 읽히는 말투.",
    "- 너무 밈스럽게 과장하지 말고, 친구에게 말하듯 짧게.",
    "- 'ㅋㅋ' 남발 금지. 하지만 무미건조한 설명문도 금지.",
    "- 한 카드에는 한 메시지만.",
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
    "각 headline은 정확히 2줄. 각 줄은 6~14자 사이를 권장한다.",
    "body는 카드당 80자 이내. 긴 설명은 caption에 쓴다.",
    "caption은 카드 내용을 반복하지 말고, 출처 기반 설명 + 댓글 유도 + CTA를 자연스럽게 쓴다.",
    "",
    "소재:",
    JSON.stringify(
      {
        id: topic.id,
        pillar: topic.pillar,
        category: topic.category,
        angleType: topic.angleType,
        oneReader: topic.oneReader,
        desiredAction: topic.desiredAction,
        hook: topic.hook,
        coverHeadline: topic.coverHeadline,
        teaseHeadline: topic.teaseHeadline,
        revealHeadline: topic.revealHeadline,
        shareHeadline: topic.shareHeadline,
        engagementHeadline: topic.engagementHeadline,
        softBridgeHeadline: topic.softBridgeHeadline,
        ctaHeadline: topic.ctaHeadline,
        curiosityQuestion: topic.curiosityQuestion,
        fact: topic.fact,
        whyFun: topic.whyFun,
        shareTrigger: topic.shareTrigger,
        pitchCheckBridge: topic.pitchCheckBridge,
        audienceScene: topic.audienceScene,
        relatabilityScore: topic.relatabilityScore,
        visualNeed: topic.visualNeed,
        imageQueries: topic.imageQueries,
        assetSearch: topic.assetSearch,
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
    const guardedItem = topic.pillar && index < 5 && hasEarlyAdSmell(item) ? {} : item;
    return {
      label: compactLine(guardedItem.label || base.label, 16),
      headline: toHeadlineLines(guardedItem.headline, base.headline),
      body: Array.isArray(base.body)
        ? toBodyLines(guardedItem.body, base.body)
        : toBody(guardedItem.body, base.body),
      accent: Array.isArray(guardedItem.accent) && guardedItem.accent.length ? guardedItem.accent.slice(0, 4) : base.accent,
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
  const proofGallery = productMedia
    .filter((item) => item.usage === "card 6 operations proof")
    .map((item) => item.id)
    .slice(0, 6);
  const ctaGallery = productIds.slice(0, 12);

  const slug = `gemini-${storyTopic.id}`;
  const cardTypes = ["cover", "stat", "story", "bridge", "story", "pitchcheck", "cta"];
  const roles = ["attention-curiosity", "interest-gap", "reveal-proof", "share-desire", "engagement", "soft-bridge", "final-cta"];
  const sourceLabel = sources.map((source) => source.label).join(", ") || "PitchCheck viral story bank";
  const storySearchQueries = [
    ...(storyTopic.assetSearch?.queries || []),
    ...(storyTopic.imageQueries || []),
    storyTopic.visualNeed,
  ].filter(Boolean);

  return {
    project: {
      slug,
      title: `피치체크 축구 바이럴 캐러셀 - ${storyTopic.hook}`,
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
        query: storySearchQueries.join(" / "),
        purpose: "Per-card viral football story image candidates for cards 1-5.",
        preferredSources: ["official club/league/tournament media", "Wikimedia Commons", "licensed editorial assets"],
        mustHave: storyTopic.assetSearch?.mustHave || ["player", "match action", "fan reaction"],
        avoid: storyTopic.assetSearch?.avoid || ["logo only", "pet/animal", "product UI before card 6"],
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
          proofBadge: "출석 · 일정 · 위치 확인",
        };
      }
      return {
        ...base,
        mediaGallery: ctaGallery,
        ctaSub: "출석 · 일정 · 위치 확인을 한 곳에서",
        ctaActionLabel: "프로필 링크",
        ctaActionValue: "설치하기",
        profileLinkNote: "댓글 [피치체크] 남기면 사용 영상도 보내드려요",
        ctaKeyword: "피치체크",
      };
    }),
    caption: copy.caption,
    notes:
      "Generated from samples/pitchcheck/viral-story-bank-60.json. Gemini only writes bounded copy; viral topic selection, no-ad early-card guardrails, CTA order, media selection, carousel upload harness, and rendering are deterministic code paths.",
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
