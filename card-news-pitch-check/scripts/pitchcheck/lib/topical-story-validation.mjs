const PUNCHLINES = new Set(['current-satire', 'irony', 'fan-self-deprecation', 'debate']);
const RISKS = new Set(['low', 'medium', 'high']);
const EARLY_CTA = /피치체크|프로필\s*링크|설치|다운로드|사용\s*영상/;
const CURIOSITY = /\?|기억|왜|무슨|어떻게|진짜 이유|그날|이 장면/;
const CONTRAST = /그때|지금|요즘|반면|하지만|였는데|기다렸|결국|아직도|보다|대신|정작|오히려/;

export function topicalCardText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(topicalCardText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(topicalCardText).join(' ');
  return '';
}

function validIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function checkRefs(topic, bank, field, errors) {
  const refs = topic?.[field];
  if (!Array.isArray(refs) || refs.length === 0) {
    errors.push(`${topic.id}: ${field} must be a non-empty array`);
    return;
  }
  const registry = bank?.[field] || {};
  for (const ref of refs) {
    if (!Object.hasOwn(registry, ref)) errors.push(`${topic.id}: missing ${field} entry ${ref}`);
  }
}

export function validateTopicalGoldenSet(bank, { expectedCount, asOf = new Date().toISOString().slice(0, 10) } = {}) {
  if (!bank || typeof bank !== 'object') throw new Error('bank must be an object');
  const errors = [];
  const topics = Array.isArray(bank.topics) ? bank.topics : [];
  if (!Array.isArray(bank.topics)) errors.push('bank.topics must be an array');
  const ids = new Set();
  let highExpiry = 0;

  for (const topic of topics) {
    const id = topic?.id || 'unknown';
    if (ids.has(id)) errors.push(`${id}: duplicate id`);
    ids.add(id);

    for (const field of ['editorialThesis', 'topicalTarget', 'topicalAsOf', 'punchlineType', 'expiryRisk', 'visualNeed']) {
      if (!topic?.[field]) errors.push(`${id}: missing ${field}`);
    }
    if (!PUNCHLINES.has(topic?.punchlineType)) errors.push(`${id}: invalid punchlineType`);
    if (!RISKS.has(topic?.expiryRisk)) errors.push(`${id}: invalid expiryRisk`);
    if (topic?.expiryRisk === 'high') highExpiry += 1;
    if (!validIsoDate(topic?.topicalAsOf)) errors.push(`${id}: topicalAsOf must be YYYY-MM-DD`);
    if (!topic?.topicalTarget?.subject || !topic?.topicalTarget?.evidenceRef) errors.push(`${id}: topicalTarget needs subject and evidenceRef`);

    const cards = topic?.copy?.cards;
    if (!Array.isArray(cards) || cards.length !== 7) errors.push(`${id}: expected exactly 7 cards`);
    for (const [index, card] of (cards || []).slice(0, 5).entries()) {
      if (!card || typeof card !== 'object' || Array.isArray(card)) errors.push(`${id}: card ${index + 1} must be structured`);
      if (EARLY_CTA.test(topicalCardText(card))) errors.push(`${id}: forbidden early CTA`);
    }
    if (!CURIOSITY.test(topicalCardText(cards?.[0]))) errors.push(`${id}: card 1 needs curiosity gap`);
    const target = topicalCardText(topic?.topicalTarget?.subject);
    const card5 = topicalCardText(cards?.[4]);
    if (!CONTRAST.test(card5) && (!target || !card5.toLowerCase().includes(target.toLowerCase()))) {
      errors.push(`${id}: card 5 must mention topical target or editorial contrast`);
    }

    if (!Array.isArray(topic?.visualNeed) || topic.visualNeed.length !== 5) {
      errors.push(`${id}: visualNeed must contain five cards`);
    } else {
      const cardsSeen = new Set();
      const pathsSeen = new Set();
      for (const need of topic.visualNeed) {
        if (!Number.isInteger(need?.card) || need.card < 1 || need.card > 5 || cardsSeen.has(need.card)) errors.push(`${id}: invalid visualNeed card`);
        cardsSeen.add(need.card);
        if (!need?.need) errors.push(`${id}: visualNeed card ${need?.card} missing need`);
        if (need?.localPath && pathsSeen.has(need.localPath)) errors.push(`${id}: duplicate visual path ${need.localPath}`);
        if (need?.localPath) pathsSeen.add(need.localPath);
      }
    }

    checkRefs(topic, bank, 'sourceRefs', errors);
    checkRefs(topic, bank, 'socialRefs', errors);

    if (topic?.expiryRisk === 'high' && validIsoDate(topic.topicalAsOf) && validIsoDate(asOf)) {
      const age = Math.abs(Date.parse(asOf) - Date.parse(topic.topicalAsOf));
      if (age > 14 * 86400000) errors.push(`${id}: stale high-risk topical copy`);
    }
  }

  if (expectedCount !== undefined && topics.length !== expectedCount) errors.push(`expected ${expectedCount} topics, got ${topics.length}`);
  if (errors.length) throw new Error(errors.join('\n'));
  return { topics: topics.length, highExpiry };
}
