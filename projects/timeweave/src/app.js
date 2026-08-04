(function initializeTimeWeave() {
  "use strict";

  const Time = window.TimeWeave;
  const defaults = ["Europe/Berlin", "Europe/London", "America/New_York", "America/Sao_Paulo"];
  const now = new Date();
  const weekdayOffset = now.getUTCDay() === 0 ? 1 : now.getUTCDay() === 6 ? 2 : 0;
  const initialDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + weekdayOffset)).toISOString().slice(0, 10);
  const elements = {
    addZone: document.querySelector("#add-zone"),
    calendar: document.querySelector("#calendar-button"),
    date: document.querySelector("#plan-date"),
    dateLabel: document.querySelector("#date-label"),
    nextDay: document.querySelector("#next-day"),
    previousDay: document.querySelector("#previous-day"),
    recommendations: document.querySelector("#recommend-grid"),
    reference: document.querySelector("#reference-zone"),
    share: document.querySelector("#share-button"),
    start: document.querySelector("#work-start"),
    end: document.querySelector("#work-end"),
    strip: document.querySelector("#selection-strip"),
    theme: document.querySelector("#theme-toggle"),
    timeline: document.querySelector("#timeline"),
    timelineScroll: document.querySelector("#timeline-scroll"),
    toast: document.querySelector("#toast"),
    utcClock: document.querySelector("#utc-clock"),
    zoneCount: document.querySelector("#zone-count"),
    zoneList: document.querySelector("#zone-list"),
    zonePicker: document.querySelector("#zone-picker")
  };
  const state = {
    zones: [...defaults], reference: defaults[0], duration: 60, selectedIndex: 18,
    date: initialDate, startHour: 9, endHour: 17, model: null
  };
  const allZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [...defaults, "Asia/Tokyo", "Asia/Singapore", "Europe/Berlin", "Australia/Sydney"];
  let toastTimer = 0;

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2000);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function saveState() {
    localStorage.setItem("timeweave-state", JSON.stringify({ zones: state.zones, reference: state.reference, duration: state.duration, startHour: state.startHour, endHour: state.endHour }));
  }

  function restoreState() {
    try {
      const saved = JSON.parse(localStorage.getItem("timeweave-state") || "null");
      if (!saved) return;
      const validZones = Array.isArray(saved.zones) ? saved.zones.filter((zone) => allZones.includes(zone)).slice(0, 8) : [];
      if (validZones.length >= 2) state.zones = validZones;
      if (state.zones.includes(saved.reference)) state.reference = saved.reference;
      if ([30, 60, 90].includes(saved.duration)) state.duration = saved.duration;
      if (Number.isInteger(saved.startHour)) state.startHour = Math.max(0, Math.min(22, saved.startHour));
      if (Number.isInteger(saved.endHour)) state.endHour = Math.max(state.startHour + 1, Math.min(24, saved.endHour));
    } catch (_error) { localStorage.removeItem("timeweave-state"); }
  }

  function readHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const zones = (params.get("zones") || "").split(",").filter((zone) => allZones.includes(zone)).slice(0, 8);
    if (zones.length >= 2) state.zones = zones;
    if (state.zones.includes(params.get("ref"))) state.reference = params.get("ref");
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "")) state.date = params.get("date");
    const slot = params.get("slot");
    const selected = Number(slot);
    if (slot !== null && Number.isInteger(selected) && selected >= 0 && selected < 48) state.selectedIndex = selected;
  }

  function populateSelects() {
    elements.reference.innerHTML = state.zones.map((zone) => `<option value="${escapeHtml(zone)}" ${zone === state.reference ? "selected" : ""}>${escapeHtml(Time.zoneLabel(zone))} / ${escapeHtml(zone)}</option>`).join("");
    const available = allZones.filter((zone) => !state.zones.includes(zone));
    elements.zonePicker.innerHTML = available.map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(Time.zoneLabel(zone))} / ${escapeHtml(zone)}</option>`).join("");
    elements.addZone.disabled = !available.length || state.zones.length >= 8;
  }

  function selectedDate() {
    return state.model.slots[Math.min(state.selectedIndex, state.model.slots.length - 1)];
  }

  function renderZones() {
    const date = selectedDate();
    elements.zoneList.innerHTML = state.zones.map((zone) => `<div class="zone-item">
      <div><strong>${escapeHtml(Time.zoneLabel(zone))}</strong><span>${escapeHtml(zone)} / ${Time.formatTime(date, zone)}</span></div>
      <button class="remove-zone" type="button" data-zone="${escapeHtml(zone)}" aria-label="Remove ${escapeHtml(Time.zoneLabel(zone))}" title="Remove location" ${state.zones.length <= 2 ? "disabled" : ""}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join("");
    elements.zoneCount.value = String(state.zones.length);
  }

  function renderTimeline() {
    const durationSlots = Math.ceil(state.duration / 30);
    const header = `<div class="timeline-corner" role="columnheader">Location / day</div>${Array.from({ length: 24 }, (_, hour) => `<div class="hour-label" role="columnheader">${String(hour).padStart(2, "0")}:00</div>`).join("")}`;
    const rows = state.model.rows.map((row) => {
      const slots = row.slots.map((slot, index) => {
        const classes = ["time-slot"];
        if (slot.working) classes.push("working");
        if (state.model.overlap[index]) classes.push("overlap");
        if (index >= state.selectedIndex && index < state.selectedIndex + durationSlots) classes.push("selected-range");
        if (index === state.selectedIndex) classes.push("selected-start");
        return `<button class="${classes.join(" ")}" type="button" role="gridcell" data-index="${index}" aria-label="${escapeHtml(row.label)} ${escapeHtml(Time.formatDate(slot.date, row.zone))} ${slot.time}${slot.working ? ", working time" : ""}"></button>`;
      }).join("");
      return `<div class="timeline-row" role="row"><div class="timeline-zone" role="rowheader"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.dateLabel)}</span></div>${slots}</div>`;
    }).join("");
    elements.timeline.innerHTML = header + rows;
  }

  function renderSelection() {
    const start = selectedDate();
    elements.strip.innerHTML = state.zones.map((zone) => `<div class="selection-zone"><span>${escapeHtml(Time.zoneLabel(zone))}</span><strong>${Time.formatTime(start, zone)}</strong><small>${escapeHtml(Time.formatDate(start, zone))}</small></div>`).join("");
  }

  function renderRecommendations(windows) {
    elements.dateLabel.textContent = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: state.reference }).format(state.model.anchor);
    if (!windows.length) {
      elements.recommendations.innerHTML = '<div class="window-empty">No shared working window</div>';
      return;
    }
    elements.recommendations.innerHTML = windows.slice(0, 6).map((window, index) => {
      const primary = Time.formatTime(window.start, state.reference);
      const other = state.zones.find((zone) => zone !== state.reference);
      return `<button class="window-card" type="button" data-index="${window.index}"><span><strong>${primary}</strong><span>${escapeHtml(Time.zoneLabel(state.reference))} / ${state.duration} min</span><small>${escapeHtml(Time.zoneLabel(other))} ${Time.formatTime(window.start, other)}</small></span><i>${String(index + 1).padStart(2, "0")}</i></button>`;
    }).join("");
  }

  function render(options) {
    const result = Time.findWindows(state.date, state.reference, state.zones, state.duration, state.startHour, state.endHour);
    state.model = result.model;
    elements.date.value = state.date;
    elements.start.value = String(state.startHour);
    elements.end.value = String(state.endHour);
    document.querySelectorAll("[data-duration]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.duration) === state.duration)));
    populateSelects();
    renderZones();
    renderTimeline();
    renderSelection();
    renderRecommendations(result.windows);
    if (options && options.scroll) {
      requestAnimationFrame(() => { elements.timelineScroll.scrollLeft = Math.max(0, 170 + state.selectedIndex * 32 - elements.timelineScroll.clientWidth / 2); });
    }
  }

  function updateSelected(index) {
    state.selectedIndex = Math.max(0, Math.min(47, index));
    render();
  }

  function copyText(text, message) {
    const fallback = () => {
      const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); showToast(message);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => showToast(message), fallback); else fallback();
  }

  function sharePlan() {
    const params = new URLSearchParams({ zones: state.zones.join(","), ref: state.reference, date: state.date, slot: String(state.selectedIndex) });
    location.hash = params.toString();
    copyText(location.href, "Plan link copied");
  }

  function downloadCalendar() {
    const content = Time.createIcs(selectedDate(), state.duration, state.zones, "Cross-time-zone meeting");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `timeweave-${state.date}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("Calendar event downloaded");
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    elements.theme.setAttribute("aria-label", selected === "dark" ? "Use light theme" : "Use dark theme");
    localStorage.setItem("timeweave-theme", selected);
  }

  function updateClock() {
    elements.utcClock.textContent = `UTC ${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())}`;
  }

  function bindEvents() {
    elements.date.addEventListener("change", () => { state.date = elements.date.value; render({ scroll: true }); });
    elements.previousDay.addEventListener("click", () => { state.date = Time.addDays(state.date, -1); render({ scroll: true }); });
    elements.nextDay.addEventListener("click", () => { state.date = Time.addDays(state.date, 1); render({ scroll: true }); });
    elements.reference.addEventListener("change", () => { state.reference = elements.reference.value; saveState(); render({ scroll: true }); });
    document.querySelectorAll("[data-duration]").forEach((button) => button.addEventListener("click", () => { state.duration = Number(button.dataset.duration); saveState(); render(); }));
    elements.start.addEventListener("change", () => { state.startHour = Math.max(0, Math.min(22, Number(elements.start.value))); if (state.endHour <= state.startHour) state.endHour = state.startHour + 1; saveState(); render(); });
    elements.end.addEventListener("change", () => { state.endHour = Math.max(state.startHour + 1, Math.min(24, Number(elements.end.value))); saveState(); render(); });
    elements.addZone.addEventListener("click", () => { if (!elements.zonePicker.value || state.zones.length >= 8) return; state.zones.push(elements.zonePicker.value); saveState(); render(); });
    elements.zoneList.addEventListener("click", (event) => { const button = event.target.closest("[data-zone]"); if (!button || state.zones.length <= 2) return; state.zones = state.zones.filter((zone) => zone !== button.dataset.zone); if (!state.zones.includes(state.reference)) state.reference = state.zones[0]; saveState(); render(); });
    elements.timeline.addEventListener("click", (event) => { const slot = event.target.closest("[data-index]"); if (slot) updateSelected(Number(slot.dataset.index)); });
    elements.recommendations.addEventListener("click", (event) => { const card = event.target.closest("[data-index]"); if (card) { updateSelected(Number(card.dataset.index)); elements.timelineScroll.scrollIntoView({ behavior: "smooth", block: "center" }); } });
    elements.share.addEventListener("click", sharePlan);
    elements.calendar.addEventListener("click", downloadCalendar);
    elements.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    window.addEventListener("hashchange", () => { readHash(); render({ scroll: true }); });
  }

  restoreState();
  readHash();
  setTheme(localStorage.getItem("timeweave-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  bindEvents();
  updateClock();
  setInterval(updateClock, 30000);
  render({ scroll: true });
})();
