export function parseJson(text) {
  if (typeof text !== 'string') throw new TypeError('JSON input must be a string');
  if (!text.trim()) throw new SyntaxError('JSON input is empty');
  return JSON.parse(text);
}

export function sortJsonKeys(value) {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === 'object') {
    const output = Object.create(null);
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) output[key] = sortJsonKeys(value[key]);
    return output;
  }
  return value;
}

function indentation(value) {
  if (value === '\t') return '\t';
  if (!Number.isInteger(value) || value < 0 || value > 10) throw new RangeError('Indent must be an integer from 0 to 10 or a tab');
  return value;
}

export function formatJson(text, options = {}) {
  const { indent = 2, sortKeys = false, finalNewline = false } = options;
  if (typeof sortKeys !== 'boolean' || typeof finalNewline !== 'boolean') throw new TypeError('sortKeys and finalNewline must be booleans');
  const parsed = parseJson(text);
  const output = JSON.stringify(sortKeys ? sortJsonKeys(parsed) : parsed, null, indentation(indent));
  return finalNewline ? `${output}\n` : output;
}

export function minifyJson(text) {
  return JSON.stringify(parseJson(text));
}

function locateError(text, message) {
  const position = message.match(/position\s+(\d+)/iu);
  if (!position) return { line: null, column: null, offset: null };
  const offset = Number(position[1]);
  const before = text.slice(0, offset);
  const lines = before.split(/\r\n|\r|\n/u);
  return { line: lines.length, column: [...lines.at(-1)].length + 1, offset };
}

export function validateJson(text) {
  try {
    const value = parseJson(text);
    return { valid: true, value, error: null, line: null, column: null, offset: null };
  } catch (error) {
    const location = locateError(typeof text === 'string' ? text : '', error.message);
    return { valid: false, value: null, error: error.message, ...location };
  }
}
