"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Time = require("../src/time.js");

test("converts wall-clock time to UTC across standard offsets", () => {
  assert.equal(Time.localToUtc("2026-01-15", 9 * 60, "Asia/Shanghai").toISOString(), "2026-01-15T01:00:00.000Z");
  assert.equal(Time.localToUtc("2026-01-15", 9 * 60, "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z");
});

test("accounts for daylight-saving offsets", () => {
  assert.equal(Time.localToUtc("2026-07-15", 9 * 60, "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z");
  assert.equal(Time.localToUtc("2026-07-15", 9 * 60, "Europe/London").toISOString(), "2026-07-15T08:00:00.000Z");
});

test("builds aligned half-hour rows and shared working slots", () => {
  const result = Time.findWindows("2026-01-12", "Europe/London", ["Europe/London", "America/New_York"], 60, 9, 17);
  assert.equal(result.model.slots.length, 48);
  assert.equal(result.model.rows.length, 2);
  assert.equal(result.model.overlap.filter(Boolean).length, 6);
  assert.deepEqual(result.windows.map((window) => Time.formatTime(window.start, "Europe/London")), ["14:00", "15:00", "16:00"]);
});

test("excludes weekends from working hours", () => {
  const saturday = new Date("2026-01-10T10:00:00.000Z");
  assert.equal(Time.isWorking(saturday, "Europe/London", 9, 17), false);
});

test("generates UTC calendar events", () => {
  const start = new Date("2026-08-03T08:30:00.000Z");
  const ics = Time.createIcs(start, 60, ["Asia/Shanghai", "Europe/London"], "Planning sync");
  assert.match(ics, /DTSTART:20260803T083000Z/);
  assert.match(ics, /DTEND:20260803T093000Z/);
  assert.match(ics, /SUMMARY:Planning sync/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test("moves ISO dates across month boundaries", () => {
  assert.equal(Time.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(Time.addDays("2024-02-28", 1), "2024-02-29");
});
