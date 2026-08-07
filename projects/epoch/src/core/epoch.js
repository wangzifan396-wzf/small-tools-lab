const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

function assertValidDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid date');
  }
  return date;
}

export function inferEpochUnit(value) {
  const input = String(value).trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(input)) {
    throw new TypeError('Timestamp must be a finite number');
  }

  const integerDigits = input.replace(/^[+-]/, '').split('.')[0].replace(/^0+(?=\d)/, '');
  return integerDigits.length >= 13 ? 'ms' : 's';
}

export function epochToDate(value, unit = 'auto') {
  if (!['auto', 's', 'ms'].includes(unit)) {
    throw new RangeError('Unit must be auto, s, or ms');
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new TypeError('Timestamp must be a finite number');
  }

  const resolvedUnit = unit === 'auto' ? inferEpochUnit(value) : unit;
  const date = new Date(resolvedUnit === 'ms' ? numeric : numeric * 1000);
  assertValidDate(date);

  return {
    date,
    unit: resolvedUnit,
    milliseconds: date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
  };
}

export function parseDateTime(value) {
  if (value instanceof Date) {
    return new Date(assertValidDate(value).getTime());
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('Date input must be a non-empty string');
  }

  const input = value.trim();
  const local = input.match(LOCAL_DATE_TIME);
  if (local) {
    const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = '0'] = local;
    const milliseconds = Number(fraction.padEnd(3, '0'));
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      milliseconds,
    );

    const matchesInput = date.getFullYear() === Number(year)
      && date.getMonth() === Number(month) - 1
      && date.getDate() === Number(day)
      && date.getHours() === Number(hour)
      && date.getMinutes() === Number(minute)
      && date.getSeconds() === Number(second)
      && date.getMilliseconds() === milliseconds;
    if (!matchesInput) throw new RangeError('Date components are out of range');
    return date;
  }

  return assertValidDate(new Date(input));
}

function pad(value, width = 2) {
  return String(value).padStart(width, '0');
}

export function formatLocal(value) {
  const date = assertValidDate(value instanceof Date ? value : new Date(value));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatUtc(value) {
  const date = assertValidDate(value instanceof Date ? value : new Date(value));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

export function formatRelative(value, now = Date.now()) {
  const target = value instanceof Date ? assertValidDate(value).getTime() : Number(value);
  const reference = now instanceof Date ? assertValidDate(now).getTime() : Number(now);
  if (!Number.isFinite(target) || !Number.isFinite(reference)) {
    throw new TypeError('Relative time values must be finite dates or timestamps');
  }

  const delta = target - reference;
  const seconds = Math.floor(Math.abs(delta) / 1000);
  if (seconds === 0) return '现在';

  const suffix = delta < 0 ? '前' : '后';
  const units = [
    ['年', 365 * 24 * 60 * 60],
    ['个月', 30 * 24 * 60 * 60],
    ['天', 24 * 60 * 60],
    ['小时', 60 * 60],
    ['分钟', 60],
    ['秒', 1],
  ];
  const [label, size] = units.find(([, unitSize]) => seconds >= unitSize);
  return `${Math.floor(seconds / size)} ${label}${suffix}`;
}
