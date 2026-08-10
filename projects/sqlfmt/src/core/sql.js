const WORD_START = /[\p{L}_]/u;
const WORD_PART = /[\p{L}\p{N}_$]/u;
const KEYWORDS = new Set(`ADD ALL ALTER AND ANY AS ASC BETWEEN BY CASE CHECK COLUMN CONSTRAINT CREATE CROSS CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DEFAULT DELETE DESC DISTINCT DO DROP ELSE END EXCEPT EXISTS FALSE FETCH FOREIGN FROM FULL GROUP HAVING IF ILIKE IN INDEX INNER INSERT INTERSECT INTO IS JOIN KEY LATERAL LEFT LIKE LIMIT NATURAL NOT NULL OFFSET ON OR OUTER OVER PARTITION PRIMARY REFERENCES RETURNING RIGHT SELECT SET TABLE THEN TRUE TRUNCATE UNION UNIQUE UPDATE USING VALUES VIEW WHEN WHERE WINDOW WITH`.split(' '));
const PHRASES = [
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'IF NOT EXISTS',
  'INSERT INTO', 'DELETE FROM', 'GROUP BY', 'ORDER BY', 'UNION ALL',
  'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'INNER JOIN', 'CROSS JOIN',
  'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
  'PRIMARY KEY', 'FOREIGN KEY', 'PARTITION BY', 'ON CONFLICT', 'DO UPDATE',
  'IS NOT', 'NOT NULL', 'IF EXISTS',
].map((phrase) => phrase.split(' '));
const MAJOR = new Set(['WITH', 'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'RETURNING', 'VALUES', 'SET', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE', 'LEFT JOIN', 'LEFT OUTER JOIN', 'RIGHT JOIN', 'RIGHT OUTER JOIN', 'FULL JOIN', 'FULL OUTER JOIN', 'INNER JOIN', 'CROSS JOIN', 'JOIN', 'ON', 'ON CONFLICT', 'DO UPDATE']);
const OPERATORS = ['->>', '#>>', '::', '->', '#>', '<=', '>=', '<>', '!=', '||', '&&', ':=', '=>', '<<', '>>'];

function locationError(message, line, column) { throw new SyntaxError(`${message} at line ${line}, column ${column}`); }

export function tokenizeSql(input) {
  if (typeof input !== 'string') throw new TypeError('SQL input must be a string');
  if (input.includes('\0')) throw new SyntaxError('SQL input cannot contain NUL bytes');
  const tokens = [];
  let position = 0;
  let line = 1;
  let column = 1;
  const advance = (text) => {
    for (const character of text) { if (character === '\n') { line += 1; column = 1; } else column += 1; }
    position += text.length;
  };
  const add = (type, raw, startLine, startColumn) => { tokens.push({ type, raw, value: raw, line: startLine, column: startColumn }); advance(raw); };
  const quoted = (quote, type, doubled = quote, prefixLength = 0) => {
    const start = position;
    const startLine = line;
    const startColumn = column;
    position += prefixLength + 1; column += prefixLength + 1;
    while (position < input.length) {
      const character = input[position];
      if (character === quote) {
        if (input[position + 1] === doubled) { position += 2; column += 2; continue; }
        position += 1; column += 1;
        const raw = input.slice(start, position);
        tokens.push({ type, raw, value: raw, line: startLine, column: startColumn });
        return;
      }
      if (character === '\\' && position + 1 < input.length) { position += 2; column += 2; continue; }
      if (character === '\n') { line += 1; column = 1; position += 1; } else { position += 1; column += 1; }
    }
    locationError(`Unterminated ${type}`, startLine, startColumn);
  };

  while (position < input.length) {
    const startLine = line;
    const startColumn = column;
    const rest = input.slice(position);
    const character = input[position];
    if (/\s/u.test(character)) {
      const match = rest.match(/^\s+/u)[0]; add('whitespace', match, startLine, startColumn); continue;
    }
    if (rest.startsWith('--') || (character === '#' && !rest.startsWith('#>'))) {
      const end = input.indexOf('\n', position);
      const raw = input.slice(position, end < 0 ? input.length : end);
      add('line-comment', raw, startLine, startColumn); continue;
    }
    if (rest.startsWith('/*')) {
      const start = position;
      let depth = 0;
      while (position < input.length) {
        if (input.startsWith('/*', position)) { depth += 1; advance('/*'); continue; }
        if (input.startsWith('*/', position)) { depth -= 1; advance('*/'); if (depth === 0) break; continue; }
        advance(input[position]);
      }
      if (depth !== 0) locationError('Unterminated block comment', startLine, startColumn);
      tokens.push({ type: 'block-comment', raw: input.slice(start, position), value: input.slice(start, position), line: startLine, column: startColumn });
      continue;
    }
    const unicodeQuote = rest.match(/^[Uu]&(['"])/u)?.[1];
    if (unicodeQuote) { quoted(unicodeQuote, unicodeQuote === "'" ? 'string' : 'quoted-identifier', unicodeQuote, 2); continue; }
    if (/^[EeNnBbXx]'/u.test(rest)) { quoted("'", 'string', "'", 1); continue; }
    if (character === "'") { quoted("'", 'string'); continue; }
    if (character === '"') { quoted('"', 'quoted-identifier'); continue; }
    if (character === '`') { quoted('`', 'quoted-identifier'); continue; }
    if (character === '[') {
      const start = position;
      position += 1; column += 1;
      let closed = false;
      while (position < input.length) {
        if (input[position] === ']' && input[position + 1] === ']') { position += 2; column += 2; continue; }
        if (input[position] === ']') { position += 1; column += 1; closed = true; break; }
        if (input[position] === '\n') { line += 1; column = 1; position += 1; } else { position += 1; column += 1; }
      }
      if (!closed) locationError('Unterminated bracket identifier', startLine, startColumn);
      const raw = input.slice(start, position);
      tokens.push({ type: 'quoted-identifier', raw, value: raw, line: startLine, column: startColumn });
      continue;
    }
    if (character === '$') {
      const delimiter = rest.match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u)?.[0];
      if (delimiter) {
        const end = input.indexOf(delimiter, position + delimiter.length);
        if (end < 0) locationError(`Unterminated dollar-quoted string ${delimiter}`, startLine, startColumn);
        add('string', input.slice(position, end + delimiter.length), startLine, startColumn); continue;
      }
      const parameter = rest.match(/^\$\d+/u)?.[0];
      if (parameter) { add('placeholder', parameter, startLine, startColumn); continue; }
    }
    if ((character === ':' || character === '@') && WORD_START.test(input[position + 1] || '')) {
      let end = position + 2;
      while (WORD_PART.test(input[end] || '')) end += 1;
      add('placeholder', input.slice(position, end), startLine, startColumn); continue;
    }
    if (WORD_START.test(character)) {
      let end = position + 1;
      while (WORD_PART.test(input[end] || '')) end += 1;
      const raw = input.slice(position, end);
      add(KEYWORDS.has(raw.toUpperCase()) ? 'keyword' : 'word', raw, startLine, startColumn); continue;
    }
    const number = rest.match(/^(?:0[xX][0-9A-Fa-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/u)?.[0];
    if (number) { add('number', number, startLine, startColumn); continue; }
    const operator = OPERATORS.find((candidate) => rest.startsWith(candidate));
    if (operator) { add('operator', operator, startLine, startColumn); continue; }
    if ('(),.;'.includes(character)) { add('punctuation', character, startLine, startColumn); continue; }
    if (character === '?') { add('placeholder', character, startLine, startColumn); continue; }
    add('operator', character, startLine, startColumn);
  }
  return tokens;
}

function significant(tokens) { return tokens.filter((token) => token.type !== 'whitespace'); }

function mergePhrases(tokens) {
  const result = [];
  for (let index = 0; index < tokens.length;) {
    let matched = null;
    for (const phrase of PHRASES) {
      const slice = tokens.slice(index, index + phrase.length);
      if (slice.length === phrase.length && slice.every((token, offset) => ['keyword', 'word'].includes(token.type) && token.raw.toUpperCase() === phrase[offset])) { matched = phrase; break; }
    }
    if (matched) {
      const first = tokens[index];
      const raw = tokens.slice(index, index + matched.length).map((token) => token.raw).join(' ');
      result.push({ ...first, type: 'keyword', raw, value: matched.join(' ') });
      index += matched.length;
    } else { result.push(tokens[index]); index += 1; }
  }
  return result;
}

function keywordText(token, keywordCase) {
  if (token.type !== 'keyword') return token.raw;
  if (keywordCase === 'upper') return token.raw.toUpperCase();
  if (keywordCase === 'lower') return token.raw.toLowerCase();
  return token.raw;
}

function indentUnit(value) {
  if (value === undefined) return '  ';
  if (Number.isInteger(value) && value >= 1 && value <= 8) return ' '.repeat(value);
  if (typeof value === 'string' && /^(?:\t| {1,8})$/u.test(value)) return value;
  throw new RangeError('indent must be 1..8 spaces or one tab');
}

function validateOptions(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  const keywordCase = options.keywordCase ?? 'upper';
  if (!['upper', 'lower', 'preserve'].includes(keywordCase)) throw new RangeError('keywordCase must be upper, lower, or preserve');
  return { keywordCase, indent: indentUnit(options.indent) };
}

function validateParentheses(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (token.type === 'punctuation' && token.raw === '(') stack.push(token);
    if (token.type === 'punctuation' && token.raw === ')') {
      if (!stack.length) locationError('Unexpected closing parenthesis', token.line, token.column);
      stack.pop();
    }
  }
  if (stack.length) locationError('Unclosed parenthesis', stack.at(-1).line, stack.at(-1).column);
}

class Writer {
  constructor(indent) { this.indent = indent; this.lines = []; this.current = ''; }
  write(text, level, space = true) {
    if (!this.current) this.current = this.indent.repeat(Math.max(0, level));
    if (space && this.current.trim() && !/\s$/u.test(this.current)) this.current += ' ';
    this.current += text;
  }
  trim() { this.current = this.current.trimEnd(); }
  newline() { this.trim(); if (this.current.trim()) this.lines.push(this.current); this.current = ''; }
  blank() { this.newline(); if (this.lines.length && this.lines.at(-1) !== '') this.lines.push(''); }
  finish() { this.newline(); while (this.lines.at(-1) === '') this.lines.pop(); return this.lines.join('\n'); }
}

export function formatSql(input, options = {}) {
  const settings = validateOptions(options);
  const tokens = mergePhrases(significant(tokenizeSql(input)));
  if (!tokens.length) return '';
  validateParentheses(tokens);
  const writer = new Writer(settings.indent);
  let depth = 0;
  let clause = '';
  let previous = null;
  let continuationLevel = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const upper = token.type === 'keyword' ? token.raw.toUpperCase() : '';
    const text = keywordText(token, settings.keywordCase);
    if (token.type === 'line-comment') { writer.write(token.raw, depth); writer.newline(); previous = token; continue; }
    if (token.type === 'block-comment') { writer.write(token.raw, depth); if (token.raw.includes('\n')) writer.newline(); previous = token; continue; }
    if (MAJOR.has(upper)) {
      if (writer.current.trim()) writer.newline();
      clause = upper;
      continuationLevel = null;
      writer.write(text, depth, false);
      previous = token; continue;
    }
    if (upper === 'AND' || upper === 'OR') {
      writer.newline(); writer.write(text, depth + 1, false); previous = token; continue;
    }
    if (upper === 'WHEN' || upper === 'ELSE') {
      writer.newline(); writer.write(text, depth + 1, false); previous = token; continue;
    }
    if (upper === 'END') { writer.newline(); writer.write(text, depth, false); previous = token; continue; }
    if (token.type === 'punctuation' && token.raw === '(') {
      const needsSpace = previous?.type === 'keyword' && ['IN', 'EXISTS', 'VALUES', 'AS'].includes(previous.raw.toUpperCase());
      writer.write('(', depth, needsSpace); depth += 1; previous = token; continue;
    }
    if (token.type === 'punctuation' && token.raw === ')') {
      depth -= 1; writer.trim(); writer.write(')', depth, false); previous = token; continue;
    }
    if (token.type === 'punctuation' && token.raw === ',') {
      writer.trim(); writer.write(',', depth, false);
      if (depth === 0 && ['SELECT', 'FROM', 'SET', 'RETURNING', 'VALUES'].includes(clause)) { writer.newline(); continuationLevel = depth + 1; }
      previous = token; continue;
    }
    if (token.type === 'punctuation' && token.raw === '.') { writer.trim(); writer.write('.', depth, false); previous = token; continue; }
    if (token.type === 'punctuation' && token.raw === ';') { writer.trim(); writer.write(';', depth, false); writer.blank(); clause = ''; previous = token; continue; }
    const afterDot = previous?.type === 'punctuation' && previous.raw === '.';
    const afterOpen = previous?.type === 'punctuation' && previous.raw === '(';
    const unary = token.type === 'operator' && ['+', '-', '~'].includes(token.raw) && (!previous || previous.type === 'operator' || (previous.type === 'punctuation' && ['(', ','].includes(previous.raw)));
    writer.write(text, continuationLevel ?? depth, !(afterDot || afterOpen || unary));
    continuationLevel = null;
    previous = token;
  }
  return writer.finish();
}

function needsMinifySpace(previous, current) {
  if (!previous) return false;
  if (previous.type === 'line-comment' || current.type === 'line-comment') return true;
  if (previous.type === 'block-comment' || current.type === 'block-comment') return true;
  if (current.type === 'punctuation' && [',', ')', ';', '.'].includes(current.raw)) return false;
  if (previous.type === 'punctuation' && ['(', '.'].includes(previous.raw)) return false;
  const wordLike = new Set(['word', 'keyword', 'number', 'string', 'quoted-identifier', 'placeholder']);
  if (wordLike.has(previous.type) && wordLike.has(current.type)) return true;
  if (previous.type === 'operator' && current.type === 'operator') return ['--', '/*', '*/'].some((value) => `${previous.raw}${current.raw}`.includes(value));
  return false;
}

export function minifySql(input, options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  if (options.removeComments !== undefined && typeof options.removeComments !== 'boolean') throw new TypeError('removeComments must be a boolean');
  let tokens = significant(tokenizeSql(input));
  validateParentheses(tokens);
  if (options.removeComments) tokens = tokens.filter((token) => !token.type.endsWith('comment'));
  let output = '';
  let previous = null;
  for (const token of tokens) {
    if (token.type === 'line-comment') {
      if (output && !/\s$/u.test(output)) output += ' ';
      output += `${token.raw.trimEnd()}\n`;
      previous = null;
      continue;
    }
    if (needsMinifySpace(previous, token) && output && !/\s$/u.test(output)) output += ' ';
    output += token.raw;
    previous = token;
  }
  return output.trim();
}
