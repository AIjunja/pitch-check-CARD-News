#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildMediaIndex, parseRenderArgs, resolveCardMedia } from './lib/topical-render-inputs.mjs';

const parsed = parseRenderArgs([
  '--bank', 'bank.json', '--media', 'media.json', '--output', 'out', '--topic', 'story-1', '--strict-media',
]);
assert.deepEqual(parsed, {
  bank: 'bank.json', media: 'media.json', output: 'out', topic: 'story-1', strictMedia: true,
});

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pitchcheck-render-'));
const frame = path.join(root, 'frame.jpg');
fs.writeFileSync(frame, 'frame');
const index = buildMediaIndex({ topics: [{ topicId: 'story-1', cards: [{ card: 1, path: 'frame.jpg', visualReview: 'pass' }] }] });
assert.equal(resolveCardMedia({ mediaIndex: index, topicId: 'story-1', cardNumber: 1, root, strictMedia: true }).file, frame);
assert.throws(
  () => resolveCardMedia({ mediaIndex: index, topicId: 'story-1', cardNumber: 2, root, strictMedia: true }),
  /Strict media missing/,
);

const unreviewed = buildMediaIndex({ topics: [{ topicId: 'story-1', cards: [{ card: 1, path: 'frame.jpg', visualReview: 'pending' }] }] });
assert.throws(
  () => resolveCardMedia({ mediaIndex: unreviewed, topicId: 'story-1', cardNumber: 1, root, strictMedia: true }),
  /not reviewed/,
);

fs.rmSync(root, { recursive: true, force: true });
console.log('topical render input tests passed');
