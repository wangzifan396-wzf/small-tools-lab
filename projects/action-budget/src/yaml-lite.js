"use strict";
// Zero-dependency YAML subset parser.
// Implements the minimal surface used by action-budget / port-matrix analyzers:
//   parse(str)                -> JS value (throws on malformed input)
//   parseDocument(str, opts)  -> { errors: [{message}], toJS(), toJSON() }
//   parseAllDocuments(str)    -> array of the above
// Supports: block mappings/sequences, flow [..]/{..} (recursive), quoted scalars,
// type inference (null/bool/int/float/string), comments, and `---` document separators.
// Does NOT implement anchors, aliases, multi-line block scalars, or directives.

function makeError(message) { return new Error(message); }

function stripComment(line) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) {
      if (inSingle && line[i + 1] === "'") { i++; continue; }
      inSingle = !inSingle;
    } else if (c === '"' && !inSingle) {
      if (inDouble && line[i + 1] === "\\") { i++; continue; }
      inDouble = !inDouble;
    } else if (c === "#" && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function findKeyColon(line) {
  let inSingle = false, inDouble = false, depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) { if (inSingle && line[i + 1] === "'") { i++; continue; } inSingle = !inSingle; }
    else if (c === '"' && !inSingle) { if (inDouble && line[i + 1] === "\\") { i++; continue; } inDouble = !inDouble; }
    else if (c === "[" && !inSingle && !inDouble) depth++;
    else if (c === "]" && !inSingle && !inDouble) depth--;
    else if (c === "{" && !inSingle && !inDouble) depth++;
    else if (c === "}" && !inSingle && !inDouble) depth--;
    else if (c === ":" && !inSingle && !inDouble && depth === 0) {
      if (i + 1 >= line.length || line[i + 1] === " " || line[i + 1] === "\t") return i;
    }
  }
  return -1;
}

function parseQuoted(token) {
  if (token.startsWith('"')) {
    let s = token.slice(1, -1);
    return s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
  }
  if (token.startsWith("'")) {
    return token.slice(1, -1).replace(/''/g, "'");
  }
  return token;
}

function isQuoted(s) { return typeof s === "string" && (s.startsWith('"') || s.startsWith("'")); }
function isFlowStart(s) { return typeof s === "string" && (s.startsWith("[") || s.startsWith("{")); }

function parseScalar(token) {
  if (token === "") return null;
  if (isQuoted(token)) return parseQuoted(token);
  const lower = token.toLowerCase();
  if (lower === "null" || lower === "~" || lower === "none" || lower === "") return null;
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (/^-?\d+$/.test(token)) { const n = parseInt(token, 10); if (Number.isSafeInteger(n)) return n; }
  if (/^-?\d+\.\d+$/.test(token)) return parseFloat(token);
  if (/^-?\d+\.\d+[eE][+-]?\d+$/.test(token)) return parseFloat(token);
  if (/^0x[0-9a-fA-F]+$/.test(token)) return parseInt(token, 16);
  return token;
}

function parseFlow(str) {
  let i = 0;
  const skipWs = () => { while (i < str.length && /\s/.test(str[i])) i++; };
  function parseQuotedToken() {
    const quote = str[i];
    let j = i + 1;
    while (j < str.length) {
      if (str[j] === quote) {
        if (quote === "'" && str[j + 1] === "'") { j += 2; continue; }
        break;
      }
      j++;
    }
    const tok = str.slice(i, j + 1);
    i = j + 1;
    return parseQuoted(tok);
  }
  function parseValue() {
    skipWs();
    if (i >= str.length) return undefined;
    const c = str[i];
    if (c === "[") return parseSeq();
    if (c === "{") return parseMap();
    if (c === '"' || c === "'") return parseQuotedToken();
    const start = i;
    while (i < str.length && str[i] !== "," && str[i] !== "]" && str[i] !== "}" && str[i] !== ":") i++;
    return parseScalar(str.slice(start, i));
  }
  function parseSeq() {
    i++;
    const arr = [];
    skipWs();
    if (str[i] === "]") { i++; return arr; }
    while (true) {
      arr.push(parseValue());
      skipWs();
      if (str[i] === ",") { i++; continue; }
      if (str[i] === "]") { i++; break; }
      throw makeError("expected , or ] in flow sequence");
    }
    return arr;
  }
  function parseMap() {
    i++;
    const obj = {};
    skipWs();
    if (str[i] === "}") { i++; return obj; }
    while (true) {
      skipWs();
      const keyStart = i;
      while (i < str.length && str[i] !== ":" && str[i] !== "," && str[i] !== "}") i++;
      const key = parseScalar(str.slice(keyStart, i).trim());
      skipWs();
      if (str[i] !== ":") throw makeError("expected : in flow mapping");
      i++;
      obj[key] = parseValue();
      skipWs();
      if (str[i] === ",") { i++; continue; }
      if (str[i] === "}") { i++; break; }
      throw makeError("expected , or } in flow mapping");
    }
    return obj;
  }
  try {
    const value = parseValue();
    skipWs();
    return { value, leftover: str.slice(i), error: null };
  } catch (e) {
    return { value: undefined, leftover: "", error: e };
  }
}

function parseSequenceItem(lines, i, indent, after) {
  const childIndent = indent + 2;
  if (isFlowStart(after)) {
    const { value, error } = parseFlow(after);
    return { value, next: i + 1, errors: error ? [error] : [] };
  }
  if (isQuoted(after)) {
    return { value: parseQuoted(after), next: i + 1, errors: [] };
  }
  if (after.includes(": ") || after.endsWith(":")) {
    const child = [{ indent: childIndent, text: after }];
    let j = i + 1;
    while (j < lines.length && lines[j].indent >= childIndent &&
           !(lines[j].indent === indent && (lines[j].text === "-" || lines[j].text.startsWith("- ")))) {
      child.push(lines[j]);
      j++;
    }
    const res = parseBlock(child, 0, childIndent);
    return { value: res.value, next: j, errors: res.errors };
  }
  return { value: parseScalar(after), next: i + 1, errors: [] };
}

function parseBlock(lines, i, indent) {
  if (i >= lines.length) return { value: null, next: i, errors: [] };
  const text = lines[i].text;
  if (text !== "-" && !text.startsWith("- ") && !isFlowStart(text) && findKeyColon(text) < 0) {
    return { value: parseScalar(text), next: i + 1, errors: [] };
  }
  const errors = [];
  if (text === "-" || text.startsWith("- ")) {
    const seq = [];
    while (i < lines.length && lines[i].indent === indent && (lines[i].text === "-" || lines[i].text.startsWith("- "))) {
      const after = lines[i].text === "-" ? "" : lines[i].text.slice(2);
      if (after.trim() === "") {
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          const res = parseBlock(lines, i + 1, lines[i + 1].indent);
          seq.push(res.value); errors.push(...res.errors); i = res.next;
        } else { seq.push(null); i++; }
      } else {
        const res = parseSequenceItem(lines, i, indent, after.trim());
        seq.push(res.value); errors.push(...res.errors); i = res.next;
      }
    }
    return { value: seq, next: i, errors };
  }
  const map = {};
  while (i < lines.length && lines[i].indent === indent && lines[i].text !== "-" && !lines[i].text.startsWith("- ")) {
    const lineText = lines[i].text;
    const colon = findKeyColon(lineText);
    if (colon < 0) { errors.push(makeError("expected mapping entry: " + lineText)); i++; continue; }
    const key = parseScalar(lineText.slice(0, colon).trim());
    const rest = lineText.slice(colon + 1).trim();
    if (rest === "") {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const res = parseBlock(lines, i + 1, lines[i + 1].indent);
        map[key] = res.value; errors.push(...res.errors); i = res.next;
      } else { map[key] = null; i++; }
    } else if (isFlowStart(rest)) {
      const { value, error } = parseFlow(rest);
      map[key] = value; if (error) errors.push(error);
      i++;
    } else if (isQuoted(rest)) {
      map[key] = parseQuoted(rest); i++;
    } else {
      map[key] = parseScalar(rest); i++;
    }
  }
  return { value: map, next: i, errors };
}

function parseDocumentContent(text) {
  const rawLines = String(text).split(/\r?\n/);
  const lines = [];
  for (const raw of rawLines) {
    const stripped = stripComment(raw);
    if (stripped.trim() === "") continue;
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, text: stripped.trim() });
  }
  if (lines.length === 0) return { value: null, errors: [] };
  const res = parseBlock(lines, 0, lines[0].indent);
  return { value: res.value, errors: res.errors };
}

function splitDocuments(text) {
  const lines = String(text).split(/\r?\n/);
  const docs = [];
  let current = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "---" || trimmed === "...") {
      if (current.length || docs.length === 0) { docs.push(current.join("\n")); current = []; }
      else { docs.push(""); current = []; }
      continue;
    }
    if (trimmed.startsWith("--- ")) {
      if (current.length || docs.length === 0) { docs.push(current.join("\n")); current = []; }
      else { docs.push(""); current = []; }
      current.push(trimmed.slice(4));
      continue;
    }
    current.push(line);
  }
  if (current.length || docs.length === 0) docs.push(current.join("\n"));
  return docs.length ? docs : [""];
}

function makeDocument(text) {
  const { value, errors } = parseDocumentContent(text);
  return {
    errors: errors.map((e) => ({ message: e.message })),
    toJS() { return value; },
    toJSON() { return value; }
  };
}

function parse(text) {
  const docs = splitDocuments(text);
  const { value, errors } = parseDocumentContent(docs[0]);
  if (errors.length) throw errors[0];
  return value;
}

function parseDocument(text) {
  return makeDocument(splitDocuments(String(text))[0]);
}

function parseAllDocuments(text) {
  return splitDocuments(String(text)).map(makeDocument);
}

module.exports = { parse, parseDocument, parseAllDocuments };
