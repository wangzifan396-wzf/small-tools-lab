function assertOptions(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  for (const key of ['plusAsSpace', 'spaceAsPlus']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new TypeError(`${key} must be a boolean`);
  }
}

function decodePart(value, plusAsSpace, segment) {
  const normalized = plusAsSpace ? value.replaceAll('+', ' ') : value;
  try { return decodeURIComponent(normalized); }
  catch { throw new URIError(`Invalid percent-encoding in query segment ${segment}`); }
}

function looksLikeLocation(value) {
  return /^[A-Za-z][A-Za-z\d+.-]*:/u.test(value)
    || value.startsWith('//')
    || value.startsWith('/')
    || value.startsWith('./')
    || value.startsWith('../')
    || value.includes('/');
}

export function parseQuery(input, options = {}) {
  if (typeof input !== 'string') throw new TypeError('Query input must be a string');
  assertOptions(options);
  const plusAsSpace = options.plusAsSpace ?? true;
  const hashIndex = input.indexOf('#');
  const fragment = hashIndex < 0 ? null : input.slice(hashIndex + 1);
  const withoutFragment = hashIndex < 0 ? input : input.slice(0, hashIndex);
  const questionIndex = withoutFragment.indexOf('?');
  let base = '';
  let query = '';
  let explicitQuestionMark = false;
  if (questionIndex >= 0) {
    base = withoutFragment.slice(0, questionIndex);
    query = withoutFragment.slice(questionIndex + 1);
    explicitQuestionMark = true;
  } else if (looksLikeLocation(withoutFragment)) {
    base = withoutFragment;
  } else {
    query = withoutFragment;
  }

  const pairs = query === '' ? [] : query.split('&').map((part, index) => {
    const equals = part.indexOf('=');
    const rawKey = equals < 0 ? part : part.slice(0, equals);
    const rawValue = equals < 0 ? '' : part.slice(equals + 1);
    return {
      key: decodePart(rawKey, plusAsSpace, index + 1),
      value: decodePart(rawValue, plusAsSpace, index + 1),
      hasEquals: equals >= 0,
    };
  });
  return { base, fragment, explicitQuestionMark, pairs };
}

function encodePart(value, spaceAsPlus) {
  if (typeof value !== 'string') throw new TypeError('Query keys and values must be strings');
  let encoded;
  try { encoded = encodeURIComponent(value); }
  catch { throw new URIError('Query keys and values must contain valid Unicode'); }
  return spaceAsPlus ? encoded.replaceAll('%20', '+') : encoded;
}

function validatePair(pair, index) {
  if (!pair || typeof pair !== 'object') throw new TypeError(`Query pair ${index + 1} must be an object`);
  if (typeof pair.hasEquals !== 'boolean') throw new TypeError(`Query pair ${index + 1} hasEquals must be a boolean`);
}

export function buildQuery(pairs, options = {}) {
  if (!Array.isArray(pairs)) throw new TypeError('Query pairs must be an array');
  assertOptions(options);
  const spaceAsPlus = options.spaceAsPlus ?? false;
  return pairs.map((pair, index) => {
    validatePair(pair, index);
    const key = encodePart(pair.key, spaceAsPlus);
    return pair.hasEquals ? `${key}=${encodePart(pair.value, spaceAsPlus)}` : key;
  }).join('&');
}

export function rebuildUrl(parsed, pairs = parsed?.pairs, options = {}) {
  if (!parsed || typeof parsed !== 'object') throw new TypeError('Parsed query must be an object');
  if (typeof parsed.base !== 'string' || typeof parsed.explicitQuestionMark !== 'boolean') throw new TypeError('Parsed query metadata is invalid');
  if (parsed.fragment !== null && typeof parsed.fragment !== 'string') throw new TypeError('Fragment must be a string or null');
  const query = buildQuery(pairs, options);
  const question = parsed.explicitQuestionMark ? '?' : '';
  const fragment = parsed.fragment === null ? '' : `#${parsed.fragment}`;
  return `${parsed.base}${question}${query}${fragment}`;
}

export function pairsToObject(pairs, options = {}) {
  if (!Array.isArray(pairs)) throw new TypeError('Query pairs must be an array');
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  const duplicates = options.duplicates ?? 'combine';
  if (!['combine', 'first', 'last'].includes(duplicates)) throw new RangeError('duplicates must be combine, first, or last');
  const result = Object.create(null);
  pairs.forEach((pair, index) => {
    validatePair(pair, index);
    if (typeof pair.key !== 'string' || typeof pair.value !== 'string') throw new TypeError('Query keys and values must be strings');
    const value = pair.hasEquals ? pair.value : null;
    if (!Object.hasOwn(result, pair.key)) {
      Object.defineProperty(result, pair.key, { value, enumerable: true, writable: true, configurable: true });
    } else if (duplicates === 'last') {
      result[pair.key] = value;
    } else if (duplicates === 'combine') {
      result[pair.key] = Array.isArray(result[pair.key]) ? [...result[pair.key], value] : [result[pair.key], value];
    }
  });
  return result;
}
