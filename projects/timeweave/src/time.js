(function attachTimeWeave(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TimeWeave = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTimeWeave() {
  "use strict";

  function zonedParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return {
      year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
      hour: Number(parts.hour), minute: Number(parts.minute), weekday: parts.weekday
    };
  }

  function localToUtc(dateString, minutes, timeZone) {
    const [year, month, day] = dateString.split("-").map(Number);
    const targetHour = Math.floor(minutes / 60);
    const targetMinute = minutes % 60;
    const target = Date.UTC(year, month - 1, day, targetHour, targetMinute);
    let guess = target;
    for (let iteration = 0; iteration < 4; iteration += 1) {
      const observed = zonedParts(new Date(guess), timeZone);
      const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
      const correction = target - observedAsUtc;
      guess += correction;
      if (!correction) break;
    }
    return new Date(guess);
  }

  function formatTime(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  }

  function formatDate(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date);
  }

  function zoneLabel(zone) {
    return zone.split("/").pop().replaceAll("_", " ");
  }

  function isWorking(date, timeZone, startHour, endHour) {
    const parts = zonedParts(date, timeZone);
    const minute = parts.hour * 60 + parts.minute;
    return !["Sat", "Sun"].includes(parts.weekday) && minute >= startHour * 60 && minute < endHour * 60;
  }

  function timeline(dateString, referenceZone, zones, startHour, endHour) {
    const anchor = localToUtc(dateString, 0, referenceZone);
    const slots = Array.from({ length: 48 }, (_, index) => new Date(anchor.getTime() + index * 30 * 60 * 1000));
    const rows = zones.map((zone) => ({
      zone,
      label: zoneLabel(zone),
      dateLabel: formatDate(slots[0], zone),
      slots: slots.map((date) => ({ date, time: formatTime(date, zone), working: isWorking(date, zone, startHour, endHour) }))
    }));
    const overlap = slots.map((date) => zones.every((zone) => isWorking(date, zone, startHour, endHour)));
    return { anchor, slots, rows, overlap };
  }

  function findWindows(dateString, referenceZone, zones, duration, startHour, endHour) {
    const model = timeline(dateString, referenceZone, zones, startHour, endHour);
    const requiredSlots = Math.ceil(duration / 30);
    const windows = [];
    for (let index = 0; index <= model.slots.length - requiredSlots; index += 1) {
      if (!model.overlap.slice(index, index + requiredSlots).every(Boolean)) continue;
      const previousEligible = index > 0 && model.overlap[index - 1];
      if (previousEligible && index % requiredSlots !== 0) continue;
      windows.push({ index, start: model.slots[index], end: new Date(model.slots[index].getTime() + duration * 60 * 1000) });
    }
    return { model, windows };
  }

  function formatIcsDate(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function escapeIcs(value) {
    return String(value).replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
  }

  function createIcs(start, duration, zones, title) {
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const stamp = formatIcsDate(new Date());
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TimeWeave//Planner//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${start.getTime()}@timeweave.local`, `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(start)}`, `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcs(title || "Cross-time-zone meeting")}`,
      `DESCRIPTION:${escapeIcs(`Planned across ${zones.join(", ")}`)}`,
      "END:VEVENT", "END:VCALENDAR", ""
    ].join("\r\n");
  }

  function addDays(dateString, amount) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount));
    return date.toISOString().slice(0, 10);
  }

  return { addDays, createIcs, findWindows, formatDate, formatIcsDate, formatTime, isWorking, localToUtc, timeline, zoneLabel, zonedParts };
});
