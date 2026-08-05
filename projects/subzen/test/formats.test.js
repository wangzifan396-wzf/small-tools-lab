import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parse,
  serialize,
  detectFormat,
  formatFromFilename,
  readableFormats,
  writableFormats,
  formats,
} from '../src/formats/index.js';

const SRT = [
  '1',
  '00:00:01,000 --> 00:00:02,000',
  'Hello world',
  '',
  '2',
  '00:00:03,000 --> 00:00:04,500',
  'Second cue',
  '',
].join('\n');

const VTT = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:02.000',
  'Hello',
  '',
  'cue-2',
  '00:00:03.000 --> 00:00:04.500',
  'Second',
  '',
].join('\n');

const LRC = ['[ti:Song]', '[00:01.00]Line one', '[00:05.00]Line two'].join('\n');

const ASS = [
  '[Script Info]',
  'Title: Test',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello{\\an8} world',
  '',
].join('\n');

const JSON_SRC = JSON.stringify({
  format: 'subzen-json',
  version: 1,
  cues: [{ index: 1, start: 1000, end: 2000, lines: ['Hi'] }],
});

test('readable and writable formats', () => {
  assert.deepEqual(readableFormats.sort(), ['ass', 'json', 'lrc', 'srt', 'vtt']);
  assert.ok(writableFormats.includes('txt'));
  assert.ok(writableFormats.includes('md'));
});

test('parse + serialize round-trips SRT', () => {
  const track = parse(SRT);
  assert.equal(track.cues.length, 2);
  assert.equal(track.cues[0].start, 1000);
  assert.equal(track.cues[0].end, 2000);
  const out = serialize(track.cues, { format: 'srt' });
  const again = parse(out);
  assert.equal(again.cues.length, 2);
  assert.equal(again.cues[0].lines[0], 'Hello world');
  assert.equal(again.cues[0].start, 1000);
});

test('parse VTT keeps cue ids and round-trips', () => {
  const track = parse(VTT);
  assert.equal(track.cues.length, 2);
  assert.equal(track.cues[1].id, 'cue-2');
  const out = serialize(track.cues, { format: 'vtt' });
  assert.ok(out.startsWith('WEBVTT'));
  assert.ok(out.includes('00:00:01.000 --> 00:00:02.000'));
  assert.ok(out.includes('cue-2'));
});

test('parse LRC infers end times from the next line', () => {
  const track = parse(LRC);
  assert.equal(track.cues.length, 2);
  assert.equal(track.cues[0].start, 1000);
  assert.equal(track.cues[1].start, 5000);
  const out = serialize(track.cues, { format: 'lrc' });
  assert.ok(out.includes('[00:01.00]'));
  assert.ok(out.includes('[00:05.00]'));
});

test('parse ASS keeps text and style', () => {
  const track = parse(ASS);
  assert.equal(track.cues.length, 1);
  assert.equal(track.cues[0].start, 1000);
  assert.equal(track.cues[0].style, 'Default');
  assert.equal(track.cues[0].lines[0], 'Hello{\\an8} world');
});

test('parse + serialize round-trips JSON', () => {
  const track = parse(JSON_SRC);
  assert.equal(track.cues.length, 1);
  assert.equal(track.cues[0].lines[0], 'Hi');
  const out = serialize(track.cues, { format: 'json' });
  const again = parse(out);
  assert.equal(again.cues[0].lines[0], 'Hi');
});

test('detectFormat by content', () => {
  assert.equal(detectFormat(SRT), 'srt');
  assert.equal(detectFormat(VTT), 'vtt');
  assert.equal(detectFormat(LRC), 'lrc');
  assert.equal(detectFormat(ASS), 'ass');
  assert.equal(detectFormat(JSON_SRC), 'json');
});

test('formatFromFilename by extension', () => {
  assert.equal(formatFromFilename('a.srt'), 'srt');
  assert.equal(formatFromFilename('a.VTT'), 'vtt');
  assert.equal(formatFromFilename('a.ass'), 'ass');
  assert.equal(formatFromFilename('a.lrc'), 'lrc');
  assert.equal(formatFromFilename('a.json'), 'json');
  assert.equal(formatFromFilename('a.txt'), 'txt');
  assert.equal(formatFromFilename('a'), null);
});

test('serializeText and serializeMarkdown', () => {
  const cues = parse(SRT).cues;
  const txt = serialize(cues, { format: 'txt' });
  assert.ok(txt.includes('Hello world'));
  const md = serialize(cues, { format: 'md' });
  assert.ok(md.includes('| Text |'));
  assert.ok(md.includes('Hello world'));
});

test('formats registry exposes parsers', () => {
  assert.equal(typeof formats.srt.parse, 'function');
  assert.equal(typeof formats.ass.serialize, 'function');
});
