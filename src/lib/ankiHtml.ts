const BLOCKED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'meta',
  'base',
]);
const STATIC_VISIBLE_IDS = new Map<string, string>([
  ['showWikt', 'Wiktionary'],
  ['showExs', 'Beispiele'],
  ['ExsTrans', 'Beispiele'],
  ['ExsNoTrans', 'Beispiele'],
]);
const STATIC_DROP_IDS = new Set([
  'aa',
  'a',
  'button',
  'answerButton',
  'buttonsBox',
  'exsents',
  'tags',
]);
const MAX_ANKI_RENDER_CACHE_SIZE = 250;
const scopedCssCache = new Map<string, string>();
const renderedMarkupCache = new Map<string, string>();

function readFromCache(cache: Map<string, string>, key: string, factory: () => string) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const nextValue = factory();
  cache.set(key, nextValue);
  if (cache.size > MAX_ANKI_RENDER_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  return nextValue;
}

function stripDisplayStyle(element: Element) {
  const styleValue = element.getAttribute('style');
  if (!styleValue) {
    return;
  }

  const nextStyle = styleValue
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.toLowerCase().startsWith('display:'));

  if (nextStyle.length === 0) {
    element.removeAttribute('style');
    return;
  }

  element.setAttribute('style', `${nextStyle.join('; ')};`);
}

function prependStaticSectionHeading(element: Element, label: string, documentNode: Document) {
  if (element.querySelector(':scope > .anki-static-section-title')) {
    return;
  }

  const heading = documentNode.createElement('div');
  heading.className = 'anki-static-section-title';
  heading.textContent = label;
  element.prepend(heading);
}

function isSafeUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('#')) return true;
  if (normalized.startsWith('/')) return true;
  if (normalized.startsWith('./') || normalized.startsWith('../')) return true;
  if (normalized.startsWith('data:')) return true;
  if (normalized.startsWith('http:') || normalized.startsWith('https:')) return true;
  if (normalized.startsWith('mailto:') || normalized.startsWith('tel:')) return true;
  if (normalized.startsWith('file:')) return true;
  return !normalized.includes(':');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function textToHtml(value: string): string {
  return escapeHtml(value).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
}

export function sanitizeAnkiHtml(value: string): string {
  if (!value.trim()) {
    return '';
  }

  if (typeof DOMParser === 'undefined') {
    return value
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div data-anki-root="true">${value}</div>`, 'text/html');
  const root = documentNode.body.firstElementChild;
  if (!root) {
    return '';
  }

  root.querySelectorAll('.anki-sound').forEach((element) => element.remove());
  root.querySelectorAll('[id]').forEach((element) => {
    const id = element.id || '';
    if (STATIC_DROP_IDS.has(id)) {
      element.remove();
      return;
    }

    const staticSectionLabel = STATIC_VISIBLE_IDS.get(id);
    if (staticSectionLabel) {
      stripDisplayStyle(element);
      element.classList.add('anki-static-section');
      prependStaticSectionHeading(element, staticSectionLabel, documentNode);
    }
  });

  const translatedExamples = root.querySelector('#ExsTrans');
  const untranslatedExamples = root.querySelector('#ExsNoTrans');
  if (translatedExamples && untranslatedExamples) {
    untranslatedExamples.remove();
  }

  const elements = Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const attrValue = attribute.value;

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((name === 'href' || name === 'src') && !isSafeUrl(attrValue)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === 'target') {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noreferrer noopener');
      }
    }
  }

  return root.innerHTML;
}

export function scopeAnkiCss(css: string, scopeSelector: string): string {
  const trimmed = css.trim();
  if (!trimmed) {
    return '';
  }
  const cacheKey = `${scopeSelector}\u0000${trimmed}`;

  return readFromCache(scopedCssCache, cacheKey, () =>
    trimmed.replace(/(^|})\s*([^@}{][^{}]*)\{/g, (_match, boundary, selectors) => {
      const scopedSelectors = selectors
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => {
          if (selector.startsWith(scopeSelector)) {
            return selector;
          }

          return `${scopeSelector} ${selector}`;
        })
        .join(', ');

      return `${boundary} ${scopedSelectors} {`;
    }),
  );
}

export function buildAnkiCardHtml(
  html: string | undefined,
  textFallback: string,
) {
  const candidate = (html || '').trim();
  const source = candidate || textToHtml(textFallback);
  return readFromCache(renderedMarkupCache, source, () => sanitizeAnkiHtml(source));
}
