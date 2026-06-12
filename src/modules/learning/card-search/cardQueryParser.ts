import type { CardQuery, CardQueryFilter, CardQueryJoiner, CardQueryParseResult } from './cardQueryTypes';

const TOKEN_RE = /(?:[^\s"]+:"[^"]+"|[^\s"]+|".*?")+/g;
const FILTER_RE = /^(?<neg>-)?(?<key>deck|tag|state|flag|due|text|is)(?::(?<value>.*))?$/i;
const DUE_RE = /^(?<op>>=|<=|>|<|=)?(?<value>-?\d+(?:\.\d+)?)$/;

function stripQuotes(value: string) {
  return value.replace(/^"/, '').replace(/"$/, '');
}

function createFilter(field: CardQueryFilter['field'], op: CardQueryFilter['op'], value: string | number): CardQueryFilter {
  return { field, op, value };
}

function parseDueFilter(rawValue: string, negated: boolean): CardQueryFilter | null {
  const match = rawValue.match(DUE_RE);
  if (!match?.groups) {
    return null;
  }

  const dueValue = Number(match.groups.value);
  const op = match.groups.op || '=';
  const normalizedOp = negated
    ? op === '>=' ? 'lt'
      : op === '<=' ? 'gt'
      : op === '>' ? 'lte'
      : op === '<' ? 'gte'
      : 'notContains'
    : op === '>=' ? 'gte'
      : op === '<=' ? 'lte'
      : op === '>' ? 'gt'
      : op === '<' ? 'lt'
      : 'is';

  return createFilter('due', normalizedOp, dueValue);
}

function parseToken(token: string): CardQueryFilter | null {
  const match = token.match(FILTER_RE);
  if (!match?.groups) {
    return null;
  }

  const key = match.groups.key.toLowerCase();
  const negated = Boolean(match.groups.neg);
  const rawValue = stripQuotes(match.groups.value || '');

  if (key === 'text') {
    return createFilter('tag', negated ? 'notContains' : 'contains', rawValue);
  }

  if (key === 'due') {
    return parseDueFilter(rawValue, negated);
  }

  if (key === 'is') {
    const normalized = rawValue.toLowerCase();
    if (normalized === 'suspended') {
      return createFilter('flag', negated ? 'isNot' : 'is', 'suspended');
    }
    return createFilter('state', negated ? 'isNot' : 'is', normalized);
  }

  if (key === 'deck') {
    return createFilter('deck', negated ? 'isNot' : 'is', rawValue);
  }

  if (key === 'tag') {
    return createFilter('tag', negated ? 'notContains' : 'contains', rawValue);
  }

  if (key === 'state') {
    return createFilter('state', negated ? 'isNot' : 'is', rawValue.toLowerCase());
  }

  if (key === 'flag') {
    return createFilter('flag', negated ? 'isNot' : 'is', rawValue.toLowerCase());
  }

  return null;
}

export function parseCardQuery(input: string, joiner: CardQueryJoiner = 'and'): CardQueryParseResult {
  const trimmed = input.trim();
  const tokens = trimmed.match(TOKEN_RE) || [];
  const filters = tokens
    .map((token) => parseToken(token))
    .filter((filter): filter is CardQueryFilter => Boolean(filter));
  const text = tokens
    .filter((token) => parseToken(token) === null)
    .map((token) => stripQuotes(token))
    .join(' ')
    .trim();

  return {
    query: {
      text,
      filters,
      joiner,
    },
    tokens,
  };
}

export function stringifyCardQuery(query: CardQuery): string {
  const textPart = query.text ? `"${query.text}"` : '';
  const filterParts = query.filters.map((filter) => {
    const prefix = filter.op === 'isNot' || filter.op === 'notContains' ? '-' : '';
    switch (filter.field) {
      case 'deck':
      case 'tag':
      case 'state':
      case 'flag':
        return `${prefix}${filter.field}:${String(filter.value)}`;
      case 'due':
        return `${prefix}due:${String(filter.value)}`;
      default:
        return `${prefix}${filter.field}:${String(filter.value)}`;
    }
  });

  return [textPart, ...filterParts].filter(Boolean).join(' ').trim();
}

