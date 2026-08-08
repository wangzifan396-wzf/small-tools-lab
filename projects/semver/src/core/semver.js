const CORE = '(0|[1-9]\\d*)';
const IDENTIFIERS = '[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*';
const VERSION = new RegExp(`^v?${CORE}\\.${CORE}\\.${CORE}(?:-(${IDENTIFIERS}))?(?:\\+(${IDENTIFIERS}))?$`, 'u');
const PARTIAL = /^(?:v)?(0|[1-9]\d*|[x*])(?:\.(0|[1-9]\d*|[x*]))?(?:\.(0|[1-9]\d*|[x*]))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/iu;

function validateIdentifiers(value, kind) {
  if (!value) return [];
  const identifiers = value.split('.');
  if (identifiers.some((identifier) => identifier === '')) throw new TypeError(`${kind} identifiers cannot be empty`);
  if (kind === 'prerelease' && identifiers.some((identifier) => /^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) {
    throw new TypeError('Numeric prerelease identifiers cannot contain leading zeros');
  }
  return identifiers;
}

export function parseVersion(value) {
  if (typeof value !== 'string') throw new TypeError('Version must be a string');
  const match = value.trim().match(VERSION);
  if (!match) throw new TypeError(`Invalid SemVer version: ${value}`);
  const prerelease = validateIdentifiers(match[4], 'prerelease');
  const build = validateIdentifiers(match[5], 'build');
  return { major: match[1], minor: match[2], patch: match[3], prerelease, build };
}

export function isValidVersion(value) {
  try { parseVersion(value); return true; } catch { return false; }
}

export function formatVersion(version) {
  const parsed = typeof version === 'string' ? parseVersion(version) : version;
  if (!parsed || !/^\d+$/u.test(parsed.major) || !/^\d+$/u.test(parsed.minor) || !/^\d+$/u.test(parsed.patch)) {
    throw new TypeError('Expected a parsed SemVer object');
  }
  const prerelease = parsed.prerelease?.length ? `-${parsed.prerelease.join('.')}` : '';
  const build = parsed.build?.length ? `+${parsed.build.join('.')}` : '';
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${prerelease}${build}`;
}

function compareNumeric(left, right) {
  const a = left.replace(/^0+(?=\d)/u, '');
  const b = right.replace(/^0+(?=\d)/u, '');
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a === b ? 0 : (a < b ? -1 : 1);
}

function asVersion(value) {
  return typeof value === 'string' ? parseVersion(value) : value;
}

export function compareVersions(left, right) {
  const a = asVersion(left);
  const b = asVersion(right);
  for (const field of ['major', 'minor', 'patch']) {
    const comparison = compareNumeric(a[field], b[field]);
    if (comparison) return comparison;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const x = a.prerelease[index];
    const y = b.prerelease[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xNumeric = /^\d+$/u.test(x);
    const yNumeric = /^\d+$/u.test(y);
    if (xNumeric && yNumeric) return compareNumeric(x, y);
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function sortVersions(versions, options = {}) {
  if (!Array.isArray(versions)) throw new TypeError('Versions must be an array');
  const direction = options.descending ? -1 : 1;
  return [...versions].sort((left, right) => direction * compareVersions(left, right));
}

function increment(value) { return String(BigInt(value) + 1n); }
function normalizedPart(value) { return value === undefined || /^[x*]$/iu.test(value) ? null : value; }

function parsePartial(value) {
  const match = value.trim().match(PARTIAL);
  if (!match) throw new RangeError(`Invalid SemVer range token: ${value}`);
  const parts = [normalizedPart(match[1]), normalizedPart(match[2]), normalizedPart(match[3])];
  if (parts[0] === null && (parts[1] !== null || parts[2] !== null)) throw new RangeError(`Invalid wildcard range: ${value}`);
  if (parts[1] === null && parts[2] !== null) throw new RangeError(`Invalid wildcard range: ${value}`);
  const precision = parts.findIndex((part) => part === null);
  const actualPrecision = precision === -1 ? 3 : precision;
  if ((match[4] || match[5]) && actualPrecision !== 3) throw new RangeError('Prerelease and build identifiers require a complete version');
  const prerelease = validateIdentifiers(match[4], 'prerelease');
  validateIdentifiers(match[5], 'build');
  return { parts, precision: actualPrecision, prerelease };
}

function versionFrom(partial) {
  const [major, minor, patch] = partial.parts.map((part) => part ?? '0');
  const prerelease = partial.prerelease.length ? `-${partial.prerelease.join('.')}` : '';
  return parseVersion(`${major}.${minor}.${patch}${prerelease}`);
}

function upperAt(partial, index) {
  const parts = partial.parts.map((part) => part ?? '0');
  parts[index] = increment(parts[index]);
  for (let cursor = index + 1; cursor < 3; cursor += 1) parts[cursor] = '0';
  return parseVersion(parts.join('.'));
}

function comparator(op, version) { return { op, version }; }

function wildcardComparators(partial) {
  if (partial.precision === 0) return [];
  const minimum = versionFrom(partial);
  if (partial.precision === 3) return [comparator('=', minimum)];
  return [comparator('>=', minimum), comparator('<', upperAt(partial, partial.precision - 1))];
}

function expandComparator(operator, partial) {
  if (!operator || operator === '=') return wildcardComparators(partial);
  if (partial.precision === 0) return [];
  const minimum = versionFrom(partial);
  if (partial.precision === 3) return [comparator(operator, minimum)];
  const upper = upperAt(partial, partial.precision - 1);
  if (operator === '>=') return [comparator('>=', minimum)];
  if (operator === '>') return [comparator('>=', upper)];
  if (operator === '<') return [comparator('<', minimum)];
  if (operator === '<=') return [comparator('<', upper)];
  throw new RangeError(`Unsupported comparator: ${operator}`);
}

function expandCaret(partial) {
  if (partial.precision === 0) return [];
  const minimum = versionFrom(partial);
  let upperIndex = 0;
  if (partial.parts[0] === '0') {
    upperIndex = partial.precision === 1 ? 0 : 1;
    if (partial.parts[1] === '0' && partial.precision === 3) upperIndex = 2;
  }
  return [comparator('>=', minimum), comparator('<', upperAt(partial, upperIndex))];
}

function expandTilde(partial) {
  if (partial.precision === 0) return [];
  const minimum = versionFrom(partial);
  const upperIndex = partial.precision === 1 ? 0 : 1;
  return [comparator('>=', minimum), comparator('<', upperAt(partial, upperIndex))];
}

function expandToken(token) {
  const match = token.match(/^(\^|~|>=|<=|>|<|=)?(.+)$/u);
  if (!match) throw new RangeError(`Invalid SemVer range token: ${token}`);
  const [, operator = '', body] = match;
  const partial = parsePartial(body);
  if (operator === '^') return expandCaret(partial);
  if (operator === '~') return expandTilde(partial);
  return expandComparator(operator, partial);
}

function expandHyphen(left, right) {
  const low = parsePartial(left);
  const high = parsePartial(right);
  const result = low.precision === 0 ? [] : [comparator('>=', versionFrom(low))];
  if (high.precision === 0) return result;
  if (high.precision === 3) result.push(comparator('<=', versionFrom(high)));
  else result.push(comparator('<', upperAt(high, high.precision - 1)));
  return result;
}

function parseSet(source) {
  const value = source.trim();
  if (!value || value === '*') return [];
  const hyphen = value.match(/^(\S+)\s+-\s+(\S+)$/u);
  if (hyphen) return expandHyphen(hyphen[1], hyphen[2]);
  return value.split(/\s+/u).flatMap(expandToken);
}

function testComparator(version, item) {
  const comparison = compareVersions(version, item.version);
  if (item.op === '=') return comparison === 0;
  if (item.op === '>') return comparison > 0;
  if (item.op === '>=') return comparison >= 0;
  if (item.op === '<') return comparison < 0;
  if (item.op === '<=') return comparison <= 0;
  return false;
}

function allowsPrerelease(version, set) {
  if (version.prerelease.length === 0) return true;
  return set.some((item) => item.version.prerelease.length > 0
    && item.version.major === version.major
    && item.version.minor === version.minor
    && item.version.patch === version.patch);
}

export function satisfies(version, range) {
  const candidate = asVersion(version);
  if (typeof range !== 'string') throw new TypeError('Range must be a string');
  const clauses = range.split('||');
  if (clauses.length > 1 && clauses.some((clause) => !clause.trim())) throw new RangeError('OR range clauses cannot be empty');
  const sets = clauses.map(parseSet);
  return sets.some((set) => allowsPrerelease(candidate, set) && set.every((item) => testComparator(candidate, item)));
}
