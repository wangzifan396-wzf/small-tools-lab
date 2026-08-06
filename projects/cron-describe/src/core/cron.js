// Zero-dependency cron expression parser + humanizer (Chinese + English).
// Supports 5-field (min hour day month weekday) and 6-field (with seconds),
// plus the common @macro shortcuts. Names (jan-dec, sun-sat) are allowed in
// month/weekday. Pure functions — safe to import anywhere.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DOWS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DOW_ZH = ['日', '一', '二', '三', '四', '五', '六'];

const MACROS = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *'
};

function resolveName(tok, map) {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  const k = tok.toLowerCase();
  if (map && Object.prototype.hasOwnProperty.call(map, k)) return map[k];
  return null;
}

// Parse one field spec into a Set of allowed integer values, or null on error.
function parseField(spec, min, max, map) {
  const out = new Set();
  for (const partRaw of spec.split(',')) {
    const part = partRaw.trim();
    if (part === '') return null;
    let step = 1;
    let range = part;
    const slash = part.indexOf('/');
    if (slash !== -1) {
      const st = parseInt(part.slice(slash + 1).trim(), 10);
      if (!Number.isInteger(st) || st <= 0) return null;
      step = st;
      range = part.slice(0, slash).trim() || '*';
    }
    let lo, hi;
    if (range === '*') {
      lo = min; hi = max;
    } else {
      const dash = range.indexOf('-');
      if (dash !== -1) {
        lo = resolveName(range.slice(0, dash).trim(), map);
        hi = resolveName(range.slice(dash + 1).trim(), map);
      } else {
        const v = resolveName(range, map);
        lo = hi = v;
      }
      if (lo == null || hi == null) return null;
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let x = lo; x <= hi; x += step) out.add(x);
  }
  return out;
}

export function parse(expr) {
  let e = String(expr == null ? '' : expr).trim().toLowerCase();
  if (e === '') return { ok: false, error: '表达式为空' };
  if (Object.prototype.hasOwnProperty.call(MACROS, e)) e = MACROS[e];
  const fields = e.split(/\s+/).filter(Boolean);
  if (fields.length !== 5 && fields.length !== 6) {
    return { ok: false, error: 'cron 表达式应为 5 段（分 时 日 月 周）或 6 段（含秒）' };
  }
  let sec = null;
  let minute, hour, dom, month, dow;
  if (fields.length === 6) {
    sec = parseField(fields[0], 0, 59, null);
    if (!sec) return { ok: false, error: '秒字段非法' };
    [minute, hour, dom, month, dow] = fields.slice(1);
  } else {
    [minute, hour, dom, month, dow] = fields;
  }
  const fMinute = parseField(minute, 0, 59, null);
  const fHour = parseField(hour, 0, 23, null);
  const fDom = parseField(dom, 1, 31, null);
  const fMonth = parseField(month, 1, 12, MONTHS);
  const fDow = parseField(dow, 0, 7, DOWS);
  if (!fMinute) return { ok: false, error: '分字段非法：' + minute };
  if (!fHour) return { ok: false, error: '时字段非法：' + hour };
  if (!fDom) return { ok: false, error: '日字段非法：' + dom };
  if (!fMonth) return { ok: false, error: '月字段非法：' + month };
  if (!fDow) return { ok: false, error: '周字段非法：' + dow };
  return {
    ok: true,
    fields: { sec, minute: fMinute, hour: fHour, dom: fDom, month: fMonth, dow: fDow },
    hasSeconds: fields.length === 6,
    stars: { minute: minute === '*', hour: hour === '*', dom: dom === '*', month: month === '*', dow: dow === '*' }
  };
}

function describeField(set, min, max, joiner) {
  const arr = [...set].sort((a, b) => a - b);
  if (arr.length === max - min + 1) return null; // covers everything
  return arr.join(joiner);
}

// Human-readable description. `stars` carries whether a field was "*" so we can
// honour cron's day-of-month / day-of-week OR rule.
export function describe(parsed) {
  const { fields: f, stars } = parsed;
  const parts = [];

  // month
  const months = describeField(f.month, 1, 12, '、');
  if (months) parts.push('每年 ' + months + ' 月');
  // day of month
  const doms = describeField(f.dom, 1, 31, '、');
  if (doms) parts.push(doms + ' 号');
  // day of week
  const dows = describeField(f.dow, 0, 7, '、');
  if (dows) {
    const names = dows.split('、').map((n) => '周' + DOW_ZH[parseInt(n, 10) % 7]).join('、');
    parts.push(names);
  }
  if (!months && !doms && !dows) parts.push('每天');

  // time of day
  const mins = describeField(f.minute, 0, 59, '、');
  const hrs = describeField(f.hour, 0, 23, '、');
  let time;
  if (!hrs && !mins) time = '每分钟';
  else if (!hrs && mins) time = '每小时的第 ' + mins + ' 分';
  else if (hrs && !mins) time = '每天 ' + hrs + ' 点整';
  else time = '每天 ' + hrs + ' 点 ' + mins + ' 分';
  if (f.sec && f.sec.size !== 60) {
    time += ' ' + describeField(f.sec, 0, 59, '、') + ' 秒';
  }
  parts.push(time + ' 执行');

  let zh = parts.join('，') + '。';
  // cron quirk: if both dom and dow were explicitly restricted, it's an OR.
  if (!stars.dom && !stars.dow) {
    zh += '（日 与 周 同时限定为「或」关系）';
  }
  return { zh, en: e_toEn(parsed) };
}

function e_toEn(p) {
  return 'Runs per cron schedule "' + rawFromParsed(p) + '".';
}

// Reconstruct a canonical expression string (seconds omitted when absent).
function rawFromParsed(p) {
  const f = p.fields;
  const get = (s) => (s.size === s.size ? [...s].sort((a, b) => a - b).join(',') : '*');
  const parts = [get(f.minute), get(f.hour), get(f.dom), get(f.month), get(f.dow)];
  return (p.hasSeconds ? get(f.sec) + ' ' : '') + parts.join(' ');
}

function matches(date, f, stars) {
  if (f.sec && !f.sec.has(date.getSeconds())) return false;
  if (!f.minute.has(date.getMinutes())) return false;
  if (!f.hour.has(date.getHours())) return false;
  if (!f.month.has(date.getMonth() + 1)) return false;
  const dow = date.getDay();
  const dowOk = f.dow.has(dow) || (dow === 0 && f.dow.has(7));
  const domOk = f.dom.has(date.getDate());
  let dayOk;
  if (stars.dom && stars.dow) dayOk = true;
  else if (stars.dom) dayOk = dowOk;
  else if (stars.dow) dayOk = domOk;
  else dayOk = domOk || dowOk;
  return dayOk;
}

// Next `count` run times. `from` is an epoch ms (defaults to now) so callers —
// and tests — can pin a deterministic reference time.
export function nextRuns(expr, count = 5, from = Date.now()) {
  const p = parse(expr);
  if (!p.ok) return { ok: false, error: p.error };
  const start = new Date(from);
  start.setSeconds(0, 0);
  if (p.hasSeconds) start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1); // begin from the next minute
  const stepMs = p.hasSeconds ? 1000 : 60000;
  const maxIter = p.hasSeconds ? 20000000 : 4000000;
  const out = [];
  let cur = new Date(start.getTime());
  let guard = 0;
  while (out.length < count && guard < maxIter) {
    if (matches(cur, p.fields, p.stars)) out.push(new Date(cur.getTime()));
    cur = new Date(cur.getTime() + stepMs);
    guard++;
  }
  return { ok: true, runs: out };
}
