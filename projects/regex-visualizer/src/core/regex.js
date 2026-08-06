// Pure, zero-dependency regex explainer + matcher. Works in Node (ESM) and the
// browser. No native modules, no network.

const ESCAPE_MEANINGS = {
  d: '任意数字 [0-9]',
  D: '任意非数字 [^0-9]',
  w: '任意单词字符 [A-Za-z0-9_]',
  W: '任意非单词字符',
  s: '任意空白字符（空格/制表/换行等）',
  S: '任意非空白字符',
  b: '单词边界（anchor）',
  B: '非单词边界（anchor）',
  n: '换行符 \\n',
  r: '回车符 \\r',
  t: '制表符 \\t',
  f: '换页符 \\f',
  v: '垂直制表符 \\v',
  '0': 'NUL 字符',
};

// Parse a regex pattern into a flat, ordered list of human-readable tokens.
// Each token: { raw, kind, meaning }. Returns { error } if the pattern is an
// invalid regular expression.
export function explain(pattern, flags = '') {
  // Validate that the regex actually compiles before explaining it.
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern, flags);
  } catch (e) {
    return { error: e.message };
  }

  const tokens = [];
  const n = pattern.length;
  let i = 0;

  while (i < n) {
    const c = pattern[i];

    // Escapes ----------------------------------------------------------------
    if (c === '\\') {
      const next = pattern[i + 1];
      if (next === undefined) {
        tokens.push({ raw: '\\', kind: 'literal', meaning: '反斜杠（末尾，视为字面量）' });
        i += 1;
        continue;
      }
      // Numeric backreference \1..\9
      if (next >= '1' && next <= '9') {
        tokens.push({ raw: pattern.slice(i, i + 2), kind: 'backreference', meaning: `反向引用第 ${next} 个捕获组` });
        i += 2;
        continue;
      }
      // Named backreference \k<name>
      if (next === 'k' && pattern[i + 2] === '<') {
        const end = pattern.indexOf('>', i + 3);
        if (end !== -1) {
          const name = pattern.slice(i + 3, end);
          tokens.push({ raw: pattern.slice(i, end + 1), kind: 'backreference', meaning: `命名反向引用 <${name}>` });
          i = end + 1;
          continue;
        }
      }
      const meaning = ESCAPE_MEANINGS[next]
        || (next >= '0' && next <= '9' ? `八进制 / 控制转义 \\${next}`
          : `字面量字符 "${next}"（转义后）`);
      const kind = next === 'b' || next === 'B' ? 'anchor' : 'escape';
      tokens.push({ raw: '\\' + next, kind, meaning });
      i += 2;
      continue;
    }

    // Anchors -----------------------------------------------------------------
    if (c === '^') { tokens.push({ raw: '^', kind: 'anchor', meaning: '字符串 / 行开头（锚点）' }); i += 1; continue; }
    if (c === '$') { tokens.push({ raw: '$', kind: 'anchor', meaning: '字符串 / 行结尾（锚点）' }); i += 1; continue; }
    if (c === '.') { tokens.push({ raw: '.', kind: 'wildcard', meaning: '除换行外任意单个字符' }); i += 1; continue; }

    // Alternation -------------------------------------------------------------
    if (c === '|') { tokens.push({ raw: '|', kind: 'alternation', meaning: '或：匹配左侧或右侧分支' }); i += 1; continue; }

    // Groups ------------------------------------------------------------------
    if (c === '(') {
      if (pattern.startsWith('(?:', i)) {
        tokens.push({ raw: '(?:', kind: 'group', meaning: '非捕获组（不记录匹配内容）' });
        i += 3; continue;
      }
      if (pattern.startsWith('(?<=', i)) {
        tokens.push({ raw: '(?<=', kind: 'group', meaning: '肯定向后查找（lookbehind）' });
        i += 4; continue;
      }
      if (pattern.startsWith('(?<!', i)) {
        tokens.push({ raw: '(?<!', kind: 'group', meaning: '否定向后查找（negative lookbehind）' });
        i += 4; continue;
      }
      if (pattern.startsWith('(?<', i)) {
        const end = pattern.indexOf('>', i + 3);
        if (end !== -1) {
          const inner = pattern.slice(i + 3, end);
          tokens.push({ raw: pattern.slice(i, end + 1), kind: 'group', meaning: `命名捕获组 «${inner}»` }); i = end + 1; continue;
        }
      }
      if (pattern.startsWith('(?=', i)) { tokens.push({ raw: '(?=', kind: 'group', meaning: '肯定向前查找（lookahead）' }); i += 3; continue; }
      if (pattern.startsWith('(?!', i)) { tokens.push({ raw: '(?!', kind: 'group', meaning: '否定向前查找（negative lookahead）' }); i += 3; continue; }
      tokens.push({ raw: '(', kind: 'group', meaning: '捕获组（记录匹配内容）' }); i += 1; continue;
    }
    if (c === ')') { tokens.push({ raw: ')', kind: 'group', meaning: '组结束' }); i += 1; continue; }

    // Character classes -------------------------------------------------------
    if (c === '[') {
      let j = i + 1;
      let neg = false;
      if (pattern[j] === '^') { neg = true; j += 1; }
      let content = '';
      while (j < n) {
        if (pattern[j] === '\\') { content += pattern.slice(j, j + 2); j += 2; continue; }
        if (pattern[j] === ']') break;
        content += pattern[j]; j += 1;
      }
      const raw = pattern.slice(i, j + 1);
      const meaning = (neg ? '否定字符集合：匹配不在集合中的' : '字符集合：匹配集合内的') + '一个字符'
        + (content ? `（${content}）` : '');
      tokens.push({ raw, kind: 'class', meaning });
      i = j + 1; continue;
    }

    // Quantifiers -------------------------------------------------------------
    if (c === '*' || c === '+' || c === '?') {
      let raw = c;
      let meaning = c === '*' ? '量词：0 次或多次'
        : c === '+' ? '量词：1 次或多次'
          : '量词：0 次或 1 次（可选）';
      if (pattern[i + 1] === '?') { raw += '?'; meaning += '（懒惰 / 非贪婪）'; i += 2; }
      else i += 1;
      tokens.push({ raw, kind: 'quantifier', meaning }); continue;
    }
    if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const inner = pattern.slice(i + 1, end);
        if (/^\d+(,\d*)?$/.test(inner)) {
          const parts = inner.split(',');
          let meaning = '量词：';
          if (parts.length === 1) meaning += `恰好 ${parts[0]} 次`;
          else if (parts[1] === '') meaning += `至少 ${parts[0]} 次`;
          else meaning += `${parts[0]}–${parts[1]} 次`;
          let raw = pattern.slice(i, end + 1);
          if (pattern[end + 1] === '?') { raw += '?'; meaning += '（懒惰 / 非贪婪）'; i = end + 2; }
          else i = end + 1;
          tokens.push({ raw, kind: 'quantifier', meaning }); continue;
        }
      }
      tokens.push({ raw: '{', kind: 'literal', meaning: '字面量字符 "{"' }); i += 1; continue;
    }

    // Literal -----------------------------------------------------------------
    tokens.push({ raw: c, kind: 'literal', meaning: `字面量字符 "${c}"` });
    i += 1;
  }

  return { tokens };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// Build a global RegExp (forcing 'g' internally so highlighting finds all
// matches even when the caller did not pass it). Returns null on bad pattern.
function buildGlobal(pattern, flags) {
  try {
    const f = flags.includes('g') ? flags : flags + 'g';
    return new RegExp(pattern, f);
  } catch {
    return null;
  }
}

// Find every match in `text`. Returns { error?, matches, namedGroups, capped }.
export function findMatches(text, pattern, flags = '') {
  const re = buildGlobal(pattern, flags);
  if (!re) {
    try { new RegExp(pattern, flags); } catch (e) { return { error: e.message, matches: [], namedGroups: [], capped: false }; }
    return { error: 'invalid regex', matches: [], namedGroups: [], capped: false };
  }
  const matches = [];
  const namedGroups = [];
  const CAP = 1000;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex += 1; continue; }
    matches.push({ index: m.index, end: m.index + m[0].length, value: m[0], groups: m.slice(1) });
    if (namedGroups.length === 0 && m.groups) namedGroups.push(...Object.keys(m.groups));
    if (matches.length >= CAP) return { matches, namedGroups, capped: true };
  }
  return { matches, namedGroups, capped: false };
}

// Return an HTML-safe string with each match wrapped in <mark>. Escapes the
// surrounding text first so the output is always safe to inject.
export function highlight(text, pattern, flags = '') {
  const re = buildGlobal(pattern, flags);
  if (!re) return escapeHtml(String(text));
  let out = '';
  let last = 0;
  let m;
  let guard = 0;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex += 1; continue; }
    if (m.index > last) out += escapeHtml(text.slice(last, m.index));
    out += '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
    if (++guard > 1000) break;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

export { escapeHtml };
