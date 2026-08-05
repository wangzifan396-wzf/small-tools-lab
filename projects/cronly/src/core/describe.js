/**
 * Human-readable description of a cron expression, in English or Chinese.
 *
 * Covers the common shapes well; for unusual combinations it falls back to a
 * faithful field-by-field listing rather than inventing prose.
 *
 * @module core/describe
 */

import { parse } from './parse.js';

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MO_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MO_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {string} expr
 * @param {{ lang?: 'en'|'zh', seconds?: boolean }} [options]
 * @returns {string}
 */
export function describe(expr, options = {}) {
  const cron = parse(expr, { seconds: options.seconds === true });
  const zh = options.lang === 'zh';
  const wd = zh ? WD_ZH : WD_EN;
  const mo = zh ? MO_ZH : MO_EN;

  // --- time of day ---
  const everyMinute = cron.minute.size === 60 && cron.hour.size === 24;
  let time;
  if (everyMinute) {
    time = zh ? '每分钟' : 'every minute';
  } else {
    const hours = [...cron.hour].sort((a, b) => a - b);
    const minutes = [...cron.minute].sort((a, b) => a - b);
    const combos = [];
    for (const h of hours) for (const m of minutes) combos.push(`${pad(h)}:${pad(m)}`);
    if (combos.length <= 12) {
      const list = combos.join(zh ? '、' : ', ');
      time = zh ? `在 ${list}` : `At ${list}`;
    } else {
      const mlist = minutes.map(String).join(zh ? '、' : ', ');
      const hEvery = cron.hour.size === 24;
      time = zh
        ? `在每小时的第 ${mlist} 分`
        : `At minute ${mlist} past ${hEvery ? 'every hour' : `hours ${hours.map(String).join(', ')}`}`;
    }
  }

  // --- day restriction ---
  // NOTE: a "star" field means "no restriction", so when dom is '*' the
  // restriction (if any) lives on the dow field, and vice-versa.
  let day = '';
  if (cron.domStar && cron.dowStar) {
    day = zh ? '每天' : 'every day';
  } else if (cron.domStar) {
    const names = [...cron.dow].sort((a, b) => a - b).map((d) => wd[d]).join(zh ? '、' : ', ');
    day = zh ? `在${names}` : `on ${names}`;
  } else if (cron.dowStar) {
    const doms = [...cron.dom].sort((a, b) => a - b).join(zh ? '、' : ', ');
    day = zh ? `每月 ${doms} 日` : `on day ${doms} of the month`;
  } else {
    const doms = [...cron.dom].sort((a, b) => a - b).join(zh ? '、' : ', ');
    const names = [...cron.dow].sort((a, b) => a - b).map((d) => wd[d]).join(zh ? '、' : ', ');
    day = zh ? `每月 ${doms} 日或${names}` : `on day ${doms} of the month or on ${names}`;
  }
  // When it runs every single minute, the day clause is redundant.
  if (everyMinute) day = '';

  // --- month restriction ---
  let month = '';
  if (cron.month.size !== 12) {
    const names = [...cron.month].sort((a, b) => a - b).map((m) => mo[m - 1]).join(zh ? '、' : ', ');
    month = zh ? `在${names}` : `in ${names}`;
  }

  if (zh) return [time, day, month].filter(Boolean).join('，') + '运行';
  return [time, day, month].filter(Boolean).join(' ');
}
