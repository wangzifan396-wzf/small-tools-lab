const NUMBER = /^[-+]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/u;
const RESERVED = /^(?:true|false|null|~)$/iu;

function fail(message, line) {
  throw new SyntaxError(line ? `Line ${line}: ${message}` : message);
}

function safeObject() {
  return Object.create(null);
}

function defineKey(object, key, value, line) {
  if (Object.hasOwn(object, key)) fail(`duplicate key ${JSON.stringify(key)}`, line);
  Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
}

function rejectFeature(value, line) {
  if (/^(?:[&*!]|<<\s*:|[>|][+-]?(?:\s|$))/u.test(value)) {
    fail('anchors, aliases, tags, merge keys, and block scalars are not supported', line);
  }
}

function decodeQuoted(value, line) {
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'string') fail('expected a quoted string', line);
      return parsed;
    } catch (error) {
      fail(`invalid double-quoted string (${error.message})`, line);
    }
  }
  if (!value.endsWith("'")) fail('unterminated single-quoted string', line);
  return value.slice(1, -1).replaceAll("''", "'");
}

class FlowParser {
  constructor(source, line) {
    this.source = source;
    this.line = line;
    this.position = 0;
  }

  error(message) { fail(`${message} near column ${this.position + 1}`, this.line); }
  peek() { return this.source[this.position]; }
  skipSpace() { while (/\s/u.test(this.peek() || '')) this.position += 1; }

  parse() {
    this.skipSpace();
    const value = this.value();
    this.skipSpace();
    if (this.position !== this.source.length) this.error('unexpected trailing content');
    return value;
  }

  value() {
    this.skipSpace();
    if (this.peek() === '[') return this.sequence();
    if (this.peek() === '{') return this.mapping();
    if (this.peek() === '"' || this.peek() === "'") return this.quoted();
    return this.plain([',', ']', '}']);
  }

  quoted() {
    const start = this.position;
    const quote = this.peek();
    this.position += 1;
    let escaped = false;
    while (this.position < this.source.length) {
      const character = this.peek();
      this.position += 1;
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && character === '\\') { escaped = true; continue; }
      if (quote === "'" && character === "'" && this.peek() === "'") { this.position += 1; continue; }
      if (character === quote) {
        return decodeQuoted(this.source.slice(start, this.position), this.line);
      }
    }
    this.error('unterminated quoted string');
  }

  plain(stops) {
    const start = this.position;
    while (this.position < this.source.length && !stops.includes(this.peek())) this.position += 1;
    const token = this.source.slice(start, this.position).trim();
    if (!token) this.error('expected a value');
    rejectFeature(token, this.line);
    if (token === 'null' || token === '~') return null;
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (NUMBER.test(token)) {
      const number = Number(token);
      if (!Number.isFinite(number)) this.error('number is outside the finite JavaScript range');
      return number;
    }
    return token;
  }

  sequence() {
    const result = [];
    this.position += 1;
    this.skipSpace();
    if (this.peek() === ']') { this.position += 1; return result; }
    while (true) {
      result.push(this.value());
      this.skipSpace();
      if (this.peek() === ']') { this.position += 1; return result; }
      if (this.peek() !== ',') this.error('expected a comma or ]');
      this.position += 1;
      this.skipSpace();
      if (this.peek() === ']') this.error('trailing commas are not supported');
    }
  }

  mapping() {
    const result = safeObject();
    this.position += 1;
    this.skipSpace();
    if (this.peek() === '}') { this.position += 1; return result; }
    while (true) {
      this.skipSpace();
      const key = this.peek() === '"' || this.peek() === "'" ? this.quoted() : this.flowKey();
      this.skipSpace();
      if (this.peek() !== ':') this.error('expected : after a mapping key');
      this.position += 1;
      defineKey(result, key, this.value(), this.line);
      this.skipSpace();
      if (this.peek() === '}') { this.position += 1; return result; }
      if (this.peek() !== ',') this.error('expected a comma or }');
      this.position += 1;
      this.skipSpace();
      if (this.peek() === '}') this.error('trailing commas are not supported');
    }
  }

  flowKey() {
    const start = this.position;
    while (this.position < this.source.length && ![':', ',', '}'].includes(this.peek())) this.position += 1;
    const key = this.source.slice(start, this.position).trim();
    if (!key) this.error('mapping keys cannot be empty');
    rejectFeature(key, this.line);
    return key;
  }
}

export function parseScalar(source) {
  if (typeof source !== 'string') throw new TypeError('Scalar input must be a string');
  const value = source.trim();
  if (!value) return null;
  return new FlowParser(value).parse();
}

function stripComment(source, line) {
  let quote = null;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote === '"' && character === '\\') { index += 1; continue; }
    if (quote) {
      if (character === quote) {
        if (quote === "'" && source[index + 1] === "'") index += 1;
        else quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '[' || character === '{') depth += 1;
    else if (character === ']' || character === '}') depth -= 1;
    else if (character === '#' && (index === 0 || /\s/u.test(source[index - 1])) && depth === 0) return source.slice(0, index).trimEnd();
    if (depth < 0) fail('unexpected closing flow delimiter', line);
  }
  if (quote) fail('unterminated quoted string', line);
  if (depth !== 0) fail('unbalanced flow collection', line);
  return source.trimEnd();
}

function findColon(source, line) {
  let quote = null;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote === '"' && character === '\\') { index += 1; continue; }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '[' || character === '{') depth += 1;
    else if (character === ']' || character === '}') depth -= 1;
    else if (character === ':' && depth === 0 && (index + 1 === source.length || /\s/u.test(source[index + 1]))) return index;
  }
  fail('mapping entry is missing a colon followed by whitespace', line);
}

function parseKey(source, line) {
  const key = source.trim();
  if (!key) fail('mapping keys cannot be empty', line);
  rejectFeature(key, line);
  if (key.startsWith('"') || key.startsWith("'")) {
    const parsed = new FlowParser(key, line).parse();
    if (typeof parsed !== 'string') fail('mapping keys must be strings', line);
    return parsed;
  }
  if (/[\[\]{},]/u.test(key)) fail('complex mapping keys are not supported', line);
  return key;
}

export function parseYaml(source) {
  if (typeof source !== 'string') throw new TypeError('YAML input must be a string');
  const rows = source.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  const lines = [];
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    if (raw.includes('\t')) fail('tabs are not allowed; use spaces for indentation', index + 1);
    const indent = raw.length - raw.trimStart().length;
    if (indent % 2 !== 0) fail('indentation must use multiples of two spaces', index + 1);
    const text = stripComment(raw.slice(indent), index + 1).trimEnd();
    if (!text.trim()) continue;
    if (text === '---' || text === '...') fail('document markers and multiple documents are not supported', index + 1);
    lines.push({ indent, text, line: index + 1 });
  }
  if (lines.length === 0) return null;
  if (lines[0].indent !== 0) fail('the document must start at indentation zero', lines[0].line);

  let position = 0;
  const childOrNull = (parentIndent) => {
    if (position >= lines.length || lines[position].indent <= parentIndent) return null;
    if (lines[position].indent !== parentIndent + 2) fail('nested content must be indented exactly two spaces', lines[position].line);
    return block(parentIndent + 2);
  };

  const entry = (object, token, keyIndent) => {
    const colon = findColon(token.text, token.line);
    const key = parseKey(token.text.slice(0, colon), token.line);
    if (key === '<<') rejectFeature('<<:', token.line);
    const rawValue = token.text.slice(colon + 1).trim();
    const value = rawValue ? new FlowParser(rawValue, token.line).parse() : childOrNull(keyIndent);
    defineKey(object, key, value, token.line);
  };

  const mapping = (indent, initial) => {
    const object = safeObject();
    if (initial) entry(object, initial, indent);
    while (position < lines.length && lines[position].indent === indent) {
      const token = lines[position];
      if (/^-(?:\s|$)/u.test(token.text)) fail('cannot mix a sequence with a mapping at the same indentation', token.line);
      position += 1;
      entry(object, token, indent);
    }
    if (position < lines.length && lines[position].indent > indent) fail('unexpected indentation', lines[position].line);
    return object;
  };

  const sequence = (indent) => {
    const array = [];
    while (position < lines.length && lines[position].indent === indent) {
      const token = lines[position];
      if (!/^-(?:\s|$)/u.test(token.text)) fail('cannot mix a mapping with a sequence at the same indentation', token.line);
      const rest = token.text.slice(1).trimStart();
      position += 1;
      if (!rest) { array.push(childOrNull(indent)); continue; }
      let colon = -1;
      try { colon = findColon(rest, token.line); } catch { colon = -1; }
      if (colon >= 0 && !rest.startsWith('[') && !rest.startsWith('{')) {
        const virtual = { text: rest, line: token.line };
        const object = safeObject();
        entry(object, virtual, indent + 2);
        while (position < lines.length && lines[position].indent === indent + 2) {
          const next = lines[position];
          if (/^-(?:\s|$)/u.test(next.text)) fail('sequence mapping entries must use key: value syntax', next.line);
          position += 1;
          entry(object, next, indent + 2);
        }
        if (position < lines.length && lines[position].indent > indent + 2) fail('unexpected indentation', lines[position].line);
        array.push(object);
      } else {
        array.push(new FlowParser(rest, token.line).parse());
        if (position < lines.length && lines[position].indent > indent) fail('a scalar sequence item cannot have nested content', lines[position].line);
      }
    }
    return array;
  };

  const block = (indent) => {
    if (position >= lines.length || lines[position].indent !== indent) fail('unexpected indentation', lines[position]?.line);
    if (/^-(?:\s|$)/u.test(lines[position].text)) return sequence(indent);
    let isMapping = true;
    try { findColon(lines[position].text, lines[position].line); }
    catch { isMapping = false; }
    if (isMapping) return mapping(indent);
    const token = lines[position];
    position += 1;
    const value = new FlowParser(token.text, token.line).parse();
    if (position < lines.length && lines[position].indent >= indent) fail('a scalar block cannot have sibling or nested content', lines[position].line);
    return value;
  };

  const result = block(0);
  if (position !== lines.length) fail('unexpected content', lines[position].line);
  return result;
}

function assertValue(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('YAML cannot serialize non-finite numbers');
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`YAML cannot serialize values of type ${typeof value}`);
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('YAML can only serialize arrays and plain objects');
  }
  if (seen.has(value)) throw new TypeError('YAML cannot serialize cyclic structures');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable) continue;
    if (typeof key === 'symbol') throw new TypeError('YAML cannot serialize symbol keys');
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError('YAML cannot serialize accessor properties');
    assertValue(descriptor.value, seen);
  }
  seen.delete(value);
}

export function stringifyScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('YAML cannot serialize non-finite numbers');
    return String(value);
  }
  if (typeof value !== 'string') throw new TypeError('Scalar value must be a string, number, boolean, or null');
  if (!value || RESERVED.test(value) || NUMBER.test(value) || /^[-?:,\[\]{}#&*!|>'"%@`]/u.test(value) || /[:#\n\r\t]/u.test(value) || /\s$/u.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function emit(value, indent) {
  const padding = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${padding}[]`;
    return value.map((item) => {
      if (item && typeof item === 'object') return `${padding}-\n${emit(item, indent + 2)}`;
      return `${padding}- ${stringifyScalar(item)}`;
    }).join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${padding}{}`;
    return entries.map(([key, item]) => {
      const renderedKey = stringifyScalar(key);
      if (item && typeof item === 'object') return `${padding}${renderedKey}:\n${emit(item, indent + 2)}`;
      return `${padding}${renderedKey}: ${stringifyScalar(item)}`;
    }).join('\n');
  }
  return `${padding}${stringifyScalar(value)}`;
}

export function stringifyYaml(value) {
  assertValue(value, new WeakSet());
  return `${emit(value, 0)}\n`;
}
