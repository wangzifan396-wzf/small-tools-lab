import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCue } from '../src/core/cue.js';
import { ruleMap, allRules, fixOrder } from '../src/rules/index.js';

test('rule registry is populated and fixOrder is a subset', () => {
  assert.ok(allRules.length >= 16);
  for (const id of fixOrder) assert.ok(ruleMap.has(id), `fixOrder references unknown ${id}`);
});

test('time-order flags inverted cues', () => {
  const rule = ruleMap.get('time-order');
  const reports = rule.check([createCue({ start: 1000, end: 500, lines: ['bad'] })], {});
  assert.equal(reports.length, 1);
});

test('no-overlap reports and fixes overlap', () => {
  const rule = ruleMap.get('no-overlap');
  const cues = [
    createCue({ start: 0, end: 2000, lines: ['a'] }),
    createCue({ start: 1500, end: 3000, lines: ['b'] }),
  ];
  assert.equal(rule.check(cues, {}).length, 1);
  const res = rule.fix(cues, {});
  assert.equal(res.cues[1].start, res.cues[0].end);
});

test('max-cps flags text that is too fast to read', () => {
  const rule = ruleMap.get('max-cps');
  const cues = [
    createCue({ start: 0, end: 500, lines: ['这是一段非常长的中文测试文字用于触发阅读速度警告'] }),
  ];
  const reports = rule.check(cues, { cjkCps: 9, latinCps: 20 });
  assert.equal(reports.length, 1);
});

test('cjk-latin-spacing fixes 盘古之白', () => {
  const rule = ruleMap.get('cjk-latin-spacing');
  const res = rule.fix([createCue({ start: 0, end: 1000, lines: ['你好world'] })], {});
  assert.equal(res.changed, 1);
  assert.equal(res.cues[0].lines[0], '你好 world');
  assert.equal(rule.check(res.cues, {}).length, 0);
});

test('cjk-punctuation-width widens punctuation but spares 1.5', () => {
  const rule = ruleMap.get('cjk-punctuation-width');
  const res = rule.fix([createCue({ start: 0, end: 1000, lines: ['你好,世界'] })], {});
  assert.equal(res.cues[0].lines[0], '你好，世界');
  const kept = rule.fix([createCue({ start: 0, end: 1000, lines: ['1.5'] })], {});
  assert.equal(kept.cues[0].lines[0], '1.5');
});

test('no-cjk-space removes stray CJK gaps', () => {
  const rule = ruleMap.get('no-cjk-space');
  const res = rule.fix([createCue({ start: 0, end: 1000, lines: ['你 好'] })], {});
  assert.equal(res.cues[0].lines[0], '你好');
});

test('no-fullwidth-latin reverts IME slips', () => {
  const rule = ruleMap.get('no-fullwidth-latin');
  const res = rule.fix([createCue({ start: 0, end: 1000, lines: ['ＡＢ１２'] })], {});
  assert.equal(res.cues[0].lines[0], 'AB12');
});

test('ellipsis-style normalises ... to …', () => {
  const rule = ruleMap.get('ellipsis-style');
  const res = rule.fix([createCue({ start: 0, end: 1000, lines: ['等等...'] })], {});
  assert.equal(res.cues[0].lines[0], '等等…');
});

test('no-line-end-period strips the trailing full stop', () => {
  const rule = ruleMap.get('no-line-end-period');
  const res = rule.fix([createCue({ start: 0, end: 1000, lines: ['你好。'] })], {});
  assert.equal(res.cues[0].lines[0], '你好');
});

test('cjk-line-start flags and fixes 行首禁则', () => {
  const rule = ruleMap.get('cjk-line-start');
  const cue = createCue({ start: 0, end: 1000, lines: ['第一行文字', '。第二行'] });
  assert.equal(rule.check([cue], {}).length, 1);
  const res = rule.fix([cue], {});
  assert.equal(res.cues[0].lines[0], '第一行文字。');
  assert.equal(res.cues[0].lines[1], '第二行');
});

test('no-empty-cue and no-duplicate-adjacent are fixable', () => {
  const empty = ruleMap.get('no-empty-cue');
  const dup = ruleMap.get('no-duplicate-adjacent');
  assert.equal(empty.fix([createCue({ start: 0, end: 1000, lines: [''] })], {}).cues.length, 0);
  const cues = [
    createCue({ start: 0, end: 1000, lines: ['x'] }),
    createCue({ start: 1000, end: 2000, lines: ['x'] }),
  ];
  assert.equal(dup.fix(cues, {}).cues.length, 1);
});
