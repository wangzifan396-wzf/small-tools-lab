export const DEFAULT_DELIMITERS = Object.freeze([',', ';', '\t', '|']);

function assertDelimiter(delimiter) {
  if (typeof delimiter !== 'string' || delimiter.length !== 1 || /["\r\n]/u.test(delimiter)) {
    throw new TypeError('Delimiter must be one character other than a quote or newline');
  }
  return delimiter;
}

export function detectDelimiter(text, candidates = DEFAULT_DELIMITERS) {
  if (typeof text !== 'string') throw new TypeError('CSV input must be a string');
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new TypeError('Delimiter candidates must be a non-empty array');
  }
  candidates.forEach(assertDelimiter);

  const counts = new Map(candidates.map((candidate) => [candidate, 0]));
  let inQuotes = false;
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (character === '\r' || character === '\n')) break;
    if (!inQuotes && counts.has(character)) counts.set(character, counts.get(character) + 1);
  }

  return candidates.reduce((best, candidate) => (
    counts.get(candidate) > counts.get(best) ? candidate : best
  ), candidates[0]);
}

export function parseCsv(text, delimiter = ',') {
  if (typeof text !== 'string') throw new TypeError('CSV input must be a string');
  assertDelimiter(delimiter);
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (input === '') return [];

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let justClosedQuote = false;
  let recordOpen = false;

  const pushField = () => {
    row.push(field);
    field = '';
    justClosedQuote = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    recordOpen = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (justClosedQuote) {
      if (character === delimiter) {
        pushField();
        recordOpen = true;
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && input[index + 1] === '\n') index += 1;
        pushRow();
      } else {
        throw new SyntaxError(`Unexpected character after closing quote at position ${index}`);
      }
      continue;
    }

    if (character === '"') {
      if (field !== '') throw new SyntaxError(`Unexpected quote at position ${index}`);
      inQuotes = true;
      recordOpen = true;
    } else if (character === delimiter) {
      pushField();
      recordOpen = true;
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      pushRow();
    } else {
      field += character;
      recordOpen = true;
    }
  }

  if (inQuotes) throw new SyntaxError('Unterminated quoted field');
  if (recordOpen || row.length > 0 || field !== '' || justClosedQuote) pushRow();
  return rows;
}

export function csvEscape(value, delimiter = ',') {
  assertDelimiter(delimiter);
  let output;
  if (value == null) output = '';
  else if (typeof value === 'object') output = JSON.stringify(value);
  else output = String(value);
  return output.includes(delimiter) || /["\r\n]/u.test(output)
    ? `"${output.replace(/"/gu, '""')}"`
    : output;
}

function isBlankRow(row) {
  return row.every((cell) => cell.trim() === '');
}

export function csvToData(text, options = {}) {
  const { delimiter: requestedDelimiter = 'auto', header = true, skipBlankRows = true } = options;
  if (typeof header !== 'boolean' || typeof skipBlankRows !== 'boolean') {
    throw new TypeError('header and skipBlankRows must be booleans');
  }
  const delimiter = requestedDelimiter === 'auto' ? detectDelimiter(text) : assertDelimiter(requestedDelimiter);
  let rows = parseCsv(text, delimiter);
  if (skipBlankRows) rows = rows.filter((row) => !isBlankRow(row));
  if (!header || rows.length === 0) return { delimiter, rows, data: rows };

  const headers = rows[0];
  if (headers.some((name) => name.trim() === '')) throw new SyntaxError('Header names cannot be empty');
  if (new Set(headers).size !== headers.length) throw new SyntaxError('Header names must be unique');

  const data = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new SyntaxError(`Row ${index + 2} has ${values.length} fields; expected ${headers.length}`);
    }
    const record = Object.create(null);
    headers.forEach((name, column) => { record[name] = values[column]; });
    return record;
  });
  return { delimiter, rows, data };
}

export function csvToJson(text, options = {}, space = 2) {
  return JSON.stringify(csvToData(text, options).data, null, space);
}

export function jsonToCsv(input, delimiter = ',') {
  assertDelimiter(delimiter);
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  const data = Array.isArray(parsed) ? parsed : [parsed];
  if (data.length === 0) return '';

  if (data.every(Array.isArray)) {
    return data.map((row) => row.map((value) => csvEscape(value, delimiter)).join(delimiter)).join('\n');
  }
  if (data.some(Array.isArray)) throw new TypeError('JSON array cannot mix rows with other value types');

  const allObjects = data.every((value) => value !== null && typeof value === 'object');
  if (allObjects) {
    const keys = [];
    const seen = new Set();
    for (const record of data) {
      for (const key of Object.keys(record)) {
        if (!seen.has(key)) { seen.add(key); keys.push(key); }
      }
    }
    if (keys.length === 0) return '';
    const lines = [keys.map((key) => csvEscape(key, delimiter)).join(delimiter)];
    for (const record of data) {
      lines.push(keys.map((key) => csvEscape(record[key], delimiter)).join(delimiter));
    }
    return lines.join('\n');
  }
  if (data.some((value) => value !== null && typeof value === 'object')) {
    throw new TypeError('JSON array cannot mix objects with primitive values');
  }
  return data.map((value) => csvEscape(value, delimiter)).join('\n');
}
