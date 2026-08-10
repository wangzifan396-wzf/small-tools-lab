const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const METHOD = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const BOOLEAN_SHORT = new Map([['s', 'silent'], ['S', 'showError'], ['L', 'follow'], ['k', 'insecure'], ['G', 'getMode'], ['I', 'head'], ['f', 'fail']]);
const VALUE_SHORT = new Set(['X', 'H', 'd', 'u', 'b', 'F', 'A', 'e', 'm']);

function syntax(message, position) {
  throw new SyntaxError(position === undefined ? message : `${message} at character ${position + 1}`);
}

export function tokenizeCurl(input) {
  if (typeof input !== 'string') throw new TypeError('curl command must be a string');
  if (input.includes('\0')) syntax('NUL bytes are not allowed');
  const tokens = [];
  let token = '';
  let started = false;
  let quote = null;
  const push = () => { if (started) { tokens.push(token); token = ''; started = false; } };
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else token += character;
      started = true;
      continue;
    }
    if (quote === '"') {
      if (character === '"') { quote = null; started = true; continue; }
      if (character === '\\') {
        if (index + 1 >= input.length) syntax('Trailing backslash', index);
        const next = input[index + 1];
        if (next === '\r' && input[index + 2] === '\n') { index += 2; continue; }
        if (next === '\n') { index += 1; continue; }
        if ('\\"`$'.includes(next)) { index += 1; token += next; }
        else token += '\\';
        started = true; continue;
      }
      if (character === '`' || (character === '$' && input[index + 1] === '(')) syntax('Command substitution is not supported', index);
      token += character; started = true; continue;
    }
    if (/\s/u.test(character)) { push(); continue; }
    if (character === "'" || character === '"') { quote = character; started = true; continue; }
    if (character === '\\') {
      if (index + 1 >= input.length) syntax('Trailing backslash', index);
      const next = input[++index];
      if (next === '\r' && input[index + 1] === '\n') { index += 1; continue; }
      if (next === '\n') continue;
      token += next; started = true; continue;
    }
    if ('|&;<>'.includes(character)) syntax('Shell pipelines, redirects, and control operators are not supported', index);
    if (character === '`' || (character === '$' && input[index + 1] === '(')) syntax('Command substitution is not supported', index);
    token += character;
    started = true;
  }
  if (quote) syntax(`Unterminated ${quote === "'" ? 'single' : 'double'} quote`);
  push();
  return tokens;
}

function takeLongValue(token, tokens, state) {
  const equals = token.indexOf('=');
  if (equals >= 0) return { name: token.slice(0, equals), value: token.slice(equals + 1) };
  const value = tokens[state.index + 1];
  if (value === undefined) syntax(`${token} requires a value`);
  state.index += 1;
  return { name: token, value };
}

function takeShortValue(token, tokens, state) {
  const name = token.slice(0, 2);
  if (token.length > 2) return { name, value: token.slice(2) };
  const value = tokens[state.index + 1];
  if (value === undefined) syntax(`${name} requires a value`);
  state.index += 1;
  return { name, value };
}

function parseHeader(value) {
  if (value.startsWith('@')) throw new TypeError('Header files are not supported');
  if (/\r|\n/u.test(value)) throw new TypeError('Header values cannot contain line breaks');
  const colon = value.indexOf(':');
  const semicolon = value.endsWith(';') ? value.length - 1 : -1;
  const separator = colon >= 0 ? colon : semicolon;
  if (separator <= 0) throw new TypeError(`Header must use Name: value syntax: ${value}`);
  const name = value.slice(0, separator).trim();
  if (!HEADER_NAME.test(name)) throw new TypeError(`Invalid HTTP header name: ${name}`);
  return { name, value: colon >= 0 ? value.slice(colon + 1).trim() : '' };
}

function formField(value) {
  const equals = value.indexOf('=');
  if (equals <= 0) throw new TypeError('Form fields must use name=value syntax');
  const name = value.slice(0, equals);
  const fieldValue = value.slice(equals + 1);
  if (fieldValue.startsWith('@') || fieldValue.startsWith('<')) throw new TypeError('Form file uploads are not supported');
  return { name, value: fieldValue };
}

function encodedField(value) {
  const equals = value.indexOf('=');
  if (equals <= 0 || value.startsWith('@')) throw new TypeError('--data-urlencode supports name=value literals only');
  return { name: value.slice(0, equals), value: value.slice(equals + 1) };
}

function validateUrl(value) {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new TypeError('curl URL must be an absolute HTTP or HTTPS URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new TypeError('Only HTTP and HTTPS curl URLs can be converted');
  return value;
}

function addWarning(warnings, message) { if (!warnings.includes(message)) warnings.push(message); }

export function parseCurl(input) {
  const tokens = tokenizeCurl(input);
  if (!tokens.length || !/(?:^|[\\/])curl(?:\.exe)?$/iu.test(tokens[0])) throw new TypeError('Command must start with curl');
  const request = {
    method: 'GET', methodExplicit: false, url: '', headers: [], data: [], form: [], auth: null,
    cookie: null, follow: false, insecure: false, getMode: false, timeoutSeconds: null, warnings: [],
  };
  const state = { index: 0 };
  const positionals = [];
  const unsupportedWithValue = new Set(['--output', '--upload-file', '--config', '--cert', '--key', '--proxy', '-o', '-T', '-K']);
  for (state.index = 1; state.index < tokens.length; state.index += 1) {
    let token = tokens[state.index];
    if (token === '--') { positionals.push(...tokens.slice(state.index + 1)); break; }
    if (token.startsWith('--')) {
      const base = token.split('=', 1)[0];
      if (unsupportedWithValue.has(base)) throw new TypeError(`${base} is intentionally unsupported because it reads files, changes routing, or has no safe target equivalent`);
      if (['--location', '--insecure', '--silent', '--show-error', '--compressed', '--fail', '--fail-with-body', '--get', '--head'].includes(base)) {
        if (token.includes('=')) syntax(`${base} does not accept a value`);
        if (base === '--location') request.follow = true;
        else if (base === '--insecure') request.insecure = true;
        else if (base === '--get') request.getMode = true;
        else if (base === '--head') { request.method = 'HEAD'; request.methodExplicit = true; }
        continue;
      }
      const { name, value } = takeLongValue(token, tokens, state);
      if (name === '--request') { request.method = value.toUpperCase(); request.methodExplicit = true; }
      else if (name === '--url') request.url = value;
      else if (name === '--header') request.headers.push(parseHeader(value));
      else if (['--data', '--data-raw', '--data-binary'].includes(name)) {
        if (name !== '--data-raw' && value.startsWith('@')) throw new TypeError(`${name} file reads are not supported`);
        request.data.push({ mode: 'raw', value });
      } else if (name === '--data-urlencode') request.data.push({ mode: 'urlencode', ...encodedField(value) });
      else if (name === '--user') request.auth = value;
      else if (name === '--cookie') { if (value.startsWith('@')) throw new TypeError('Cookie files are not supported'); request.cookie = value; }
      else if (name === '--form') request.form.push(formField(value));
      else if (name === '--user-agent') request.headers.push({ name: 'User-Agent', value });
      else if (name === '--referer') request.headers.push({ name: 'Referer', value });
      else if (name === '--max-time') request.timeoutSeconds = Number(value);
      else throw new TypeError(`Unsupported curl option: ${name}`);
      continue;
    }
    if (token.startsWith('-') && token !== '-') {
      if (token.length > 2 && [...token.slice(1)].every((flag) => BOOLEAN_SHORT.has(flag))) {
        for (const flag of token.slice(1)) {
          const property = BOOLEAN_SHORT.get(flag);
          if (property === 'head') { request.method = 'HEAD'; request.methodExplicit = true; }
          else if (property in request) request[property] = true;
        }
        continue;
      }
      const short = token[1];
      if (BOOLEAN_SHORT.has(short) && token.length === 2) {
        const property = BOOLEAN_SHORT.get(short);
        if (property === 'head') { request.method = 'HEAD'; request.methodExplicit = true; }
        else if (property in request) request[property] = true;
        continue;
      }
      if (!VALUE_SHORT.has(short)) {
        if (unsupportedWithValue.has(token.slice(0, 2))) throw new TypeError(`${token.slice(0, 2)} is intentionally unsupported`);
        throw new TypeError(`Unsupported curl option: ${token}`);
      }
      const { name, value } = takeShortValue(token, tokens, state);
      if (name === '-X') { request.method = value.toUpperCase(); request.methodExplicit = true; }
      else if (name === '-H') request.headers.push(parseHeader(value));
      else if (name === '-d') { if (value.startsWith('@')) throw new TypeError('-d file reads are not supported'); request.data.push({ mode: 'raw', value }); }
      else if (name === '-u') request.auth = value;
      else if (name === '-b') { if (value.startsWith('@')) throw new TypeError('Cookie files are not supported'); request.cookie = value; }
      else if (name === '-F') request.form.push(formField(value));
      else if (name === '-A') request.headers.push({ name: 'User-Agent', value });
      else if (name === '-e') request.headers.push({ name: 'Referer', value });
      else if (name === '-m') request.timeoutSeconds = Number(value);
      continue;
    }
    positionals.push(token);
  }
  if (positionals.length > 1 || (positionals.length && request.url)) throw new TypeError('Exactly one curl URL is supported');
  request.url = validateUrl(request.url || positionals[0] || '');
  if (!METHOD.test(request.method)) throw new TypeError(`Invalid HTTP method: ${request.method}`);
  if (request.form.length && request.data.length) throw new TypeError('Mixing --form and --data is not supported');
  if (!request.methodExplicit && (request.form.length || request.data.length) && !request.getMode) request.method = 'POST';
  if (request.getMode && !request.methodExplicit) request.method = 'GET';
  if (['GET', 'HEAD'].includes(request.method) && !request.getMode && (request.form.length || request.data.length)) {
    throw new TypeError(`${request.method} request bodies cannot be represented safely by Fetch`);
  }
  if (request.form.length && ['GET', 'HEAD'].includes(request.method)) throw new TypeError(`${request.method} cannot use multipart form data`);
  if (request.timeoutSeconds !== null && (!Number.isFinite(request.timeoutSeconds) || request.timeoutSeconds <= 0)) throw new RangeError('--max-time must be a positive number');
  if (request.insecure) addWarning(request.warnings, '--insecure cannot be represented by standards-based Fetch and weakens TLS verification in Python');
  if (request.headers.some((header) => ['cookie', 'user-agent', 'referer'].includes(header.name.toLowerCase())) || request.cookie) {
    addWarning(request.warnings, 'Browsers may block Cookie, User-Agent, or Referer request headers; Node.js Fetch is less restrictive');
  }
  const names = request.headers.map((header) => header.name.toLowerCase());
  if (new Set(names).size !== names.length) addWarning(request.warnings, 'Duplicate headers are preserved by Fetch but Python requests may combine or replace them');
  if (tokens.some((value) => /\$(?:[A-Za-z_]\w*|\{)/u.test(value))) addWarning(request.warnings, 'Shell variables are preserved literally because this converter does not expand the shell environment');
  if (request.auth !== null) {
    const colon = request.auth.indexOf(':');
    request.auth = { username: colon < 0 ? request.auth : request.auth.slice(0, colon), password: colon < 0 ? '' : request.auth.slice(colon + 1) };
  }
  return request;
}

function contentType(request) {
  return [...request.headers].reverse().find((header) => header.name.toLowerCase() === 'content-type')?.value.toLowerCase() || '';
}

function encodedData(data) {
  return data.map((item) => item.mode === 'raw'
    ? item.value
    : `${encodeURIComponent(item.name)}=${encodeURIComponent(item.value)}`).join('&');
}

function urlWithQuery(url, data) {
  if (!data.length) return url;
  const parsed = new URL(url);
  const extra = encodedData(data);
  parsed.search = [parsed.search.slice(1), extra].filter(Boolean).join('&');
  return parsed.href;
}

function jsString(value) { return JSON.stringify(value); }
function pythonString(value) { return JSON.stringify(value).replaceAll('\\u2028', '\\u2028').replaceAll('\\u2029', '\\u2029'); }

export function toFetch(request) {
  const url = request.getMode ? urlWithQuery(request.url, request.data) : request.url;
  const lines = [`const url = ${jsString(url)};`];
  if (request.form.length) {
    lines.push('const form = new FormData();');
    for (const field of request.form) lines.push(`form.append(${jsString(field.name)}, ${jsString(field.value)});`);
  }
  const headers = [...request.headers];
  if (request.cookie && !headers.some((header) => header.name.toLowerCase() === 'cookie')) headers.push({ name: 'Cookie', value: request.cookie });
  lines.push('const headers = new Headers();');
  for (const header of headers) lines.push(`headers.append(${jsString(header.name)}, ${jsString(header.value)});`);
  if (request.auth) {
    lines.push(`const credentials = new TextEncoder().encode(${jsString(`${request.auth.username}:${request.auth.password}`)});`);
    lines.push("headers.set('Authorization', `Basic ${btoa(String.fromCharCode(...credentials))}`);");
  }
  lines.push('const options = {', `  method: ${jsString(request.method)},`, '  headers,', `  redirect: ${jsString(request.follow ? 'follow' : 'manual')},`);
  if (request.timeoutSeconds !== null) lines.push(`  signal: AbortSignal.timeout(${Math.round(request.timeoutSeconds * 1000)}),`);
  if (request.form.length) lines.push('  body: form,');
  else if (request.data.length && !request.getMode) {
    const raw = encodedData(request.data);
    if (contentType(request).includes('application/json') && request.data.length === 1 && request.data[0].mode === 'raw') {
      let parsed;
      try { parsed = JSON.parse(request.data[0].value); }
      catch { throw new TypeError('Content-Type is JSON but the curl body is not valid JSON'); }
      lines.push(`  body: JSON.stringify(${JSON.stringify(parsed, null, 2).replaceAll('\n', '\n  ')}),`);
    } else lines.push(`  body: ${jsString(raw)},`);
  }
  lines.push('};', '', 'const response = await fetch(url, options);', "if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);", "const result = response.headers.get('content-type')?.includes('application/json')", '  ? await response.json()', '  : await response.text();', 'console.log(result);');
  if (request.warnings.length) lines.unshift(...request.warnings.map((warning) => `// Warning: ${warning}`), '');
  return lines.join('\n');
}

export function toPythonRequests(request) {
  const url = request.getMode ? urlWithQuery(request.url, request.data) : request.url;
  const needsJson = request.data.length === 1 && !request.getMode && request.data[0].mode === 'raw' && contentType(request).includes('application/json');
  const lines = ['import json', 'import requests', '', `url = ${pythonString(url)}`, 'headers = {'];
  const headers = [...request.headers];
  if (request.cookie && !headers.some((header) => header.name.toLowerCase() === 'cookie')) headers.push({ name: 'Cookie', value: request.cookie });
  const latest = new Map(headers.map((header) => [header.name.toLowerCase(), header]));
  for (const header of latest.values()) lines.push(`    ${pythonString(header.name)}: ${pythonString(header.value)},`);
  lines.push('}', '', 'response = requests.request(', `    ${pythonString(request.method)},`, '    url,', '    headers=headers,');
  if (request.auth) lines.push(`    auth=(${pythonString(request.auth.username)}, ${pythonString(request.auth.password)}),`);
  if (request.form.length) {
    const entries = request.form.map((field) => `(${pythonString(field.name)}, (None, ${pythonString(field.value)}))`).join(', ');
    lines.push(`    files=[${entries}],`);
  } else if (request.data.length && !request.getMode) {
    if (needsJson) {
      try { JSON.parse(request.data[0].value); }
      catch { throw new TypeError('Content-Type is JSON but the curl body is not valid JSON'); }
      lines.push(`    json=json.loads(${pythonString(request.data[0].value)}),`);
    } else lines.push(`    data=${pythonString(encodedData(request.data))},`);
  }
  if (request.timeoutSeconds !== null) lines.push(`    timeout=${request.timeoutSeconds},`);
  if (request.follow) lines.push('    allow_redirects=True,');
  else lines.push('    allow_redirects=False,');
  if (request.insecure) lines.push('    verify=False,');
  lines.push(')', 'response.raise_for_status()', 'print(response.text)');
  if (request.warnings.length) lines.unshift(...request.warnings.map((warning) => `# Warning: ${warning}`), '');
  return lines.join('\n');
}

export function convertCurl(input) {
  const request = parseCurl(input);
  return { request, fetch: toFetch(request), python: toPythonRequests(request) };
}
