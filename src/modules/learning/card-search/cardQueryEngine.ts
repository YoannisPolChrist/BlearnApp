import type { CardQuery, CardQueryCardShape, CardQueryFilter } from './cardQueryTypes';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesFilter(card: CardQueryCardShape, filter: CardQueryFilter): boolean {
  const value = String(filter.value);

  switch (filter.field) {
    case 'deck':
      return filter.op === 'isNot'
        ? normalize(card.deckId) !== normalize(value) && normalize(card.deckName) !== normalize(value)
        : normalize(card.deckId) === normalize(value) || normalize(card.deckName) === normalize(value);
    case 'tag':
      return filter.op === 'notContains'
        ? !card.tags.some((tag) => normalize(tag).includes(normalize(value)))
        : card.tags.some((tag) => normalize(tag).includes(normalize(value)));
    case 'state':
      return filter.op === 'isNot'
        ? card.state !== value
        : card.state === value;
    case 'flag':
      if (value === 'suspended') {
        return filter.op === 'isNot' ? !card.suspended : card.suspended;
      }
      return false;
    case 'due': {
      const dueDays = card.dueAt;
      const threshold = Number(filter.value);
      switch (filter.op) {
        case 'gte':
          return dueDays >= threshold;
        case 'lte':
          return dueDays <= threshold;
        case 'gt':
          return dueDays > threshold;
        case 'lt':
          return dueDays < threshold;
        case 'is':
          return dueDays === threshold;
        default:
          return dueDays !== threshold;
      }
    }
    default:
      return true;
  }
}

function matchesText(card: CardQueryCardShape, text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) {
    return true;
  }

  return [
    card.front,
    card.back,
    card.deckName,
    card.tags.join(' '),
    card.state,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

export function matchesCardQuery(card: CardQueryCardShape, query: CardQuery): boolean {
  const matchesFilters =
    query.filters.length === 0
      ? true
      : query.joiner === 'or'
        ? query.filters.some((filter) => matchesFilter(card, filter))
        : query.filters.every((filter) => matchesFilter(card, filter));

  return matchesFilters && matchesText(card, query.text);
}

export function runCardQuery(cards: CardQueryCardShape[], query: CardQuery): CardQueryCardShape[] {
  return cards.filter((card) => matchesCardQuery(card, query));
}

export function runCardQueryIds(cards: CardQueryCardShape[], query: CardQuery): string[] {
  return runCardQuery(cards, query).map((card) => card.cardId);
}

export function buildCardQuerySql(query: CardQuery): string {
  const textClause = query.text ? `LOWER(front || ' ' || back || ' ' || deck_name || ' ' || tags) LIKE '%${query.text.toLowerCase()}%'` : '1=1';
  const filterClauses = query.filters.map((filter) => {
    switch (filter.field) {
      case 'deck':
        return filter.op === 'isNot'
          ? `(LOWER(deck_id) <> LOWER('${String(filter.value)}') AND LOWER(deck_name) <> LOWER('${String(filter.value)}'))`
          : `(LOWER(deck_id) = LOWER('${String(filter.value)}') OR LOWER(deck_name) = LOWER('${String(filter.value)}'))`;
      case 'tag':
        return filter.op === 'notContains'
          ? `LOWER(tags) NOT LIKE '%${String(filter.value).toLowerCase()}%'`
          : `LOWER(tags) LIKE '%${String(filter.value).toLowerCase()}%'`;
      case 'state':
        return filter.op === 'isNot'
          ? `LOWER(state) <> LOWER('${String(filter.value)}')`
          : `LOWER(state) = LOWER('${String(filter.value)}')`;
      case 'flag':
        return filter.op === 'isNot' ? 'suspended = 0' : 'suspended = 1';
      case 'due':
        return `due_at ${filter.op === 'gte' ? '>=' : filter.op === 'lte' ? '<=' : filter.op === 'gt' ? '>' : filter.op === 'lt' ? '<' : '='} ${Number(filter.value)}`;
      default:
        return '1=1';
    }
  });

  const joiner = query.joiner === 'or' ? ' OR ' : ' AND ';
  return [textClause, ...filterClauses].join(joiner);
}

