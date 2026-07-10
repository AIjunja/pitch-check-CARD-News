const FORBIDDEN_EARLY = /피치체크|프로필\s*링크|설치|다운로드|사용\s*영상|앱/;

function cardText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(cardText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(cardText).join(" ");
  return "";
}

export function validateStoryBank(bank, { expectedCount } = {}) {
  const errors = [];
  const eventKeys = new Set();
  const topics = bank?.topics ?? [];
  const sourceRefs = bank?.sourceRefs ?? {};

  for (const topic of topics) {
    const topicId = topic?.id ?? "unknown topic";
    const eventKey =
      typeof topic?.eventKey === "string" ? topic.eventKey.trim() : topic?.eventKey;

    if (!eventKey) {
      errors.push(`${topicId}: missing eventKey`);
    } else if (eventKeys.has(eventKey)) {
      errors.push(`${topicId}: duplicate eventKey`);
    } else {
      eventKeys.add(eventKey);
    }

    const cards = topic?.copy?.cards;
    if (!Array.isArray(cards) || cards.length !== 7) {
      errors.push(`${topicId}: expected exactly 7 cards`);
    }

    for (const card of Array.isArray(cards) ? cards.slice(0, 5) : []) {
      if (FORBIDDEN_EARLY.test(cardText(card))) {
        errors.push(`${topicId}: forbidden early CTA`);
      }
    }

    const topicSourceRefs = topic?.sourceRefs;
    if (!Array.isArray(topicSourceRefs)) {
      errors.push(`${topicId}: sourceRefs must be an array`);
    } else {
      for (const sourceRef of topicSourceRefs) {
        if (!Object.hasOwn(sourceRefs, sourceRef)) {
          errors.push(`${topicId}: missing source ${sourceRef}`);
        }
      }
    }
  }

  if (expectedCount !== undefined && topics.length !== expectedCount) {
    errors.push(`expected ${expectedCount} topics, got ${topics.length}`);
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return { topics: topics.length, uniqueEvents: eventKeys.size };
}
