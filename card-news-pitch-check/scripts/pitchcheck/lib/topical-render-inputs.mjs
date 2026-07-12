import fs from 'node:fs';
import path from 'node:path';

export function parseRenderArgs(args, defaults = {}) {
  const valueAfter = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : fallback;
  };
  return {
    bank: valueAfter('--bank', defaults.bank),
    media: valueAfter('--media', defaults.media),
    output: valueAfter('--output', defaults.output),
    topic: valueAfter('--topic', null),
    strictMedia: args.includes('--strict-media'),
  };
}

export function buildMediaIndex(media) {
  return new Map((media.topics || []).map((topic) => [
    topic.topicId,
    new Map((topic.cards || []).map((card) => [card.card, card])),
  ]));
}

export function resolveCardMedia({ mediaIndex, topicId, cardNumber, root, strictMedia }) {
  const card = mediaIndex.get(topicId)?.get(cardNumber);
  if (!card) {
    if (strictMedia) throw new Error(`Strict media missing: ${topicId} card ${cardNumber}`);
    return null;
  }
  if (strictMedia && card.visualReview !== 'pass') {
    throw new Error(`Strict media is not reviewed: ${topicId} card ${cardNumber}`);
  }
  const file = path.resolve(root, card.path);
  if (!fs.existsSync(file)) {
    if (strictMedia) throw new Error(`Strict media file missing: ${file}`);
    return null;
  }
  return { ...card, file };
}
