const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const W = require("./load")("core/lib/weather.js");

const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "wttr-sample.json"), "utf8"));

test("fmtTemp: rounds, clamps to -99..99 and shows a dash for junk", () => {
  assert.equal(W.fmtTemp("24"), "24°C");
  assert.equal(W.fmtTemp(-5), "-5°C");
  assert.equal(W.fmtTemp("0"), "0°C");
  assert.equal(W.fmtTemp("21.6"), "22°C");
  assert.equal(W.fmtTemp("-0.4"), "0°C"); // no "-0"
  assert.equal(W.fmtTemp("99"), "99°C");
  assert.equal(W.fmtTemp("-99"), "-99°C");
  assert.equal(W.fmtTemp("150"), "99°C");
  assert.equal(W.fmtTemp("-150"), "-99°C");
  for (const bad of ["", "abc", undefined, null, NaN, Infinity, {}, []]) assert.equal(W.fmtTemp(bad), "–", String(bad));
});

test("fmtPct: 0..100, rounds, clamps, dash for junk", () => {
  assert.equal(W.fmtPct("0"), "0%");
  assert.equal(W.fmtPct("100"), "100%");
  assert.equal(W.fmtPct("98"), "98%");
  assert.equal(W.fmtPct("49.6"), "50%");
  assert.equal(W.fmtPct("101"), "100%");
  assert.equal(W.fmtPct("-3"), "0%");
  for (const bad of ["", "abc", undefined, null, NaN, {}]) assert.equal(W.fmtPct(bad), "–", String(bad));
});

test("pct: numeric counterpart, NaN for junk", () => {
  assert.equal(W.pct("42"), 42);
  assert.equal(W.pct("200"), 100);
  assert.ok(Number.isNaN(W.pct("x")));
});

test("fmtHour: wttr times become the hour without a leading zero", () => {
  const expected = { "0": "0", "300": "3", "600": "6", "900": "9", "1200": "12", "1500": "15", "1800": "18", "2100": "21" };
  for (const [t, h] of Object.entries(expected)) assert.equal(W.fmtHour(t), h, t);
  assert.equal(W.fmtHour(0), "0");
  assert.equal(W.fmtHour(2300), "23");
});

test("fmtHour: out-of-range and junk give a dash", () => {
  for (const bad of ["", "abc", "2400", "-100", undefined, null, NaN, {}]) assert.equal(W.fmtHour(bad), "–", String(bad));
});

test("to24h converts wttr's English 12-hour times", () => {
  assert.equal(W.to24h("07:25 AM"), "07:25");
  assert.equal(W.to24h("07:06 PM"), "19:06");
  assert.equal(W.to24h("12:05 AM"), "00:05");
  assert.equal(W.to24h("12:30 PM"), "12:30");
  assert.equal(W.to24h("7:05 am"), "07:05");
  assert.equal(W.to24h(" 11:59 PM "), "23:59");
  assert.equal(W.to24h("19:06"), "19:06"); // already 24 h
});

test("to24h: invalid input gives a dash", () => {
  for (const bad of ["", "noon", "25:00", "13:00 PM", "12:60 PM", "07:25 XM", undefined, null, 5, {}]) assert.equal(W.to24h(bad), "–", String(bad));
});

test("iconFor: known codes, unknown codes and junk", () => {
  assert.equal(W.iconFor("113"), "☀️");
  assert.equal(W.iconFor("122"), "☁️");
  assert.equal(W.iconFor("200"), "⛈️");
  assert.equal(W.iconFor("335"), "❄️");
  assert.equal(W.iconFor("999999"), "☁️");
  for (const bad of [undefined, null, "", {}]) assert.equal(W.iconFor(bad), "☁️");
});

test("dayLabel follows HyDE: Today, Tomorrow, then the plain date", () => {
  assert.equal(W.dayLabel(0, "2026-09-30"), "Today, 2026-09-30");
  assert.equal(W.dayLabel(1, "2026-10-01"), "Tomorrow, 2026-10-01");
  assert.equal(W.dayLabel(2, "2026-10-02"), "2026-10-02");
  assert.equal(W.dayLabel(0, undefined), "Today");
});

test("parseLocation reads [weather] location and nothing else", () => {
  assert.equal(W.parseLocation('[weather]\nlocation = "52.0167,8.5333"\n'), "52.0167,8.5333");
  assert.equal(W.parseLocation("[weather]\nlocation = 'Berlin'"), "Berlin");
  assert.equal(W.parseLocation('# comment\n[other]\nlocation = "no"\n[weather]\n  location   =   "Köln"   # my city\n'), "Köln");
  assert.equal(W.parseLocation('[weather]\n# location = "old"\nlocation = "new"'), "new");
});

test("parseLocation: missing, empty, wrong section, garbage", () => {
  for (const bad of ["", "   ", undefined, null, 5, "[weather]", "[weather]\nlocation = \"\"", '[other]\nlocation = "x"', "[weather]\nlocation = unquoted",
                     '[weather]\nlocation = "' + "x".repeat(101) + '"', '[weather]\nlocation = "a\u0007b"', "[weather\nlocation = \"x\""]) {
    assert.equal(W.parseLocation(bad), "", String(bad).slice(0, 40));
  }
  // the next section ends the search
  assert.equal(W.parseLocation('[weather]\nunits = "m"\n[other]\nlocation = "x"'), "");
});

test("wttrUrl encodes the location and works without one", () => {
  assert.equal(W.wttrUrl("52.0,8.5"), "https://wttr.in/52.0%2C8.5?format=j1");
  assert.equal(W.wttrUrl("Köln"), "https://wttr.in/K%C3%B6ln?format=j1");
  assert.equal(W.wttrUrl("a b/c?d"), "https://wttr.in/a%20b%2Fc%3Fd?format=j1");
  assert.equal(W.wttrUrl(""), "https://wttr.in/?format=j1");
  assert.equal(W.wttrUrl(undefined), "https://wttr.in/?format=j1");
});

test("parseWttr: the sample becomes a model with three days", () => {
  const m = W.parseWttr(SAMPLE, undefined);
  assert.equal(m.ok, true);
  assert.equal(m.place, "Testville, Nowhere");
  assert.equal(m.days.length, 3);
  assert.match(m.days[0].label, /^Today, \d{4}-\d{2}-\d{2}$/);
  assert.match(m.days[1].label, /^Tomorrow, /);
  assert.equal(m.days[2].label, SAMPLE.weather[2].date);
  assert.match(m.face, /^.+ \d+°C \| Testville, Nowhere$/);
  assert.match(m.now.wind, /^\d+ km\/h$/);
  assert.match(m.now.humidity, /^\d+%$/);
});

test("parseWttr: day summary and slot fields are pre-formatted", () => {
  const d = W.parseWttr(SAMPLE, undefined).days[0];
  assert.match(d.hi, /°C$/); assert.match(d.lo, /°C$/);
  assert.match(d.sunrise, /^\d\d:\d\d$/); assert.match(d.sunset, /^\d\d:\d\d$/);
  assert.equal(d.slots.length, 8);
  const s = d.slots[0];
  assert.equal(s.hour, "0");
  assert.equal(d.slots[1].hour, "3");
  assert.match(s.temp, /^-?\d+°C$/);
  for (const k of ["clouds", "rain", "sun", "wind"]) assert.match(s[k], /^(\d|[1-9]\d|100)%$/, k);
  assert.ok(Array.isArray(s.extra));
});

test("parseWttr: today's past slots are dropped like HyDE does (from two hours ago), other days keep all", () => {
  const m = W.parseWttr(SAMPLE, 13); // 13 o'clock: hours before 11 are gone
  assert.deepEqual(m.days[0].slots.map((s) => s.hour), ["12", "15", "18", "21"]);
  assert.equal(m.days[1].slots.length, 8);
  assert.deepEqual(W.parseWttr(SAMPLE, 0).days[0].slots.length, 8);
  assert.equal(W.parseWttr(SAMPLE, 23).days[0].slots.length, 1); // 21 h is the last one within two hours
});

test("parseWttr: extra chances list only the rare ones above zero, without commas", () => {
  const data = JSON.parse(JSON.stringify(SAMPLE));
  Object.assign(data.weather[0].hourly[0], { chanceoffog: "4", chanceofsnow: "0", chanceofthunder: "12", chanceoffrost: "abc" });
  const extra = W.parseWttr(data, undefined).days[0].slots[0].extra;
  assert.deepEqual(extra, ["Fog 4%", "Thunder 12%"]);
});

test("parseWttr: out-of-spec values are clamped, junk becomes a dash", () => {
  const data = JSON.parse(JSON.stringify(SAMPLE));
  Object.assign(data.weather[0].hourly[1], { tempC: "-150", chanceofrain: "300", chanceofsunshine: "-5", chanceofwindy: "x", time: "2100" });
  const s = W.parseWttr(data, undefined).days[0].slots[1];
  assert.equal(s.temp, "-99°C");
  assert.equal(s.rain, "100%");
  assert.equal(s.sun, "0%");
  assert.equal(s.wind, "–");
  assert.equal(s.hour, "21");
});

test("parseWttr: missing pieces degrade to dashes instead of throwing", () => {
  const data = { current_condition: [{}], weather: [{ hourly: [{}] }, {}], nearest_area: [] };
  const m = W.parseWttr(data, undefined);
  assert.equal(m.ok, true);
  assert.equal(m.days[0].hi, "–");
  assert.equal(m.days[0].sunrise, "–");
  assert.equal(m.days[0].slots[0].hour, "–");
  assert.equal(m.days[1].slots.length, 0);
  assert.equal(m.place, "");
  assert.doesNotThrow(() => W.parseWttr({ current_condition: [{ weatherDesc: [] }], weather: [] }, undefined));
});

test("parseWttr: unusable input is reported, never thrown", () => {
  for (const bad of [undefined, null, 5, "x", [], {}, { current_condition: [] }, { current_condition: [{}] }, { weather: [] }]) {
    const m = W.parseWttr(bad, undefined);
    assert.equal(m.ok, false, JSON.stringify(bad));
    assert.ok(m.error.length > 0);
  }
});

test("parseWttr: more or fewer than three days are handled", () => {
  const one = JSON.parse(JSON.stringify(SAMPLE)); one.weather = one.weather.slice(0, 1);
  assert.equal(W.parseWttr(one, undefined).days.length, 1);
  const five = JSON.parse(JSON.stringify(SAMPLE)); five.weather = [...five.weather, ...five.weather];
  assert.equal(W.parseWttr(five, undefined).days.length, 3); // the panel shows three days
});

test("parseWttr never mutates its input", () => {
  const copy = JSON.stringify(SAMPLE);
  W.parseWttr(SAMPLE, 13);
  assert.equal(JSON.stringify(SAMPLE), copy);
});

// ---- flatten: the model laid out as grid cells -----------------------------

test("flatten: a header row, then per day a title, a summary and one row per slot, all nine columns wide", () => {
  const cells = W.flatten(W.parseWttr(SAMPLE, undefined));
  assert.equal(W.COLUMNS, 9);
  assert.equal(cells.length, 9 + 3 * (2 + 8 * 9));
  // every row is complete: spans add up to whole rows and no row is split
  let col = 0;
  for (const c of cells) {
    col += c.span;
    assert.ok(col <= W.COLUMNS, "a row overflows");
    if (col === W.COLUMNS) col = 0;
  }
  assert.equal(col, 0);
});

test("flatten: header names, day cells and the order of the slot columns", () => {
  const cells = W.flatten(W.parseWttr(SAMPLE, undefined));
  assert.deepEqual(cells.slice(0, 9).map((c) => c.text), ["Hour", "", "Temp", "Sky", "Clouds", "Rain", "Sun", "Wind", ""]);
  assert.ok(cells.slice(0, 9).every((c) => c.kind === "head"));
  const title = cells[9], summary = cells[10];
  assert.equal(title.kind, "dayTitle"); assert.equal(title.span, 9); assert.match(title.text, /^Today, /);
  assert.equal(summary.kind, "summary"); assert.equal(summary.span, 9);
  assert.deepEqual(Object.keys(summary).filter((k) => ["hi", "lo", "sunrise", "sunset"].includes(k)).sort(), ["hi", "lo", "sunrise", "sunset"]);
  assert.deepEqual(cells.slice(11, 20).map((c) => c.kind), ["hour", "icon", "temp", "desc", "pct", "pct", "pct", "pct", "extra"]);
  assert.equal(cells[11].text, "0");
});

test("flatten: only the very first day title is marked first, so the panel can space the others", () => {
  const titles = W.flatten(W.parseWttr(SAMPLE, undefined)).filter((c) => c.kind === "dayTitle");
  assert.deepEqual(titles.map((t) => t.first), [true, false, false]);
});

test("flatten: percentages of 0 or unknown are dimmed, real values are not; extra cells hold no commas", () => {
  const data = JSON.parse(JSON.stringify(SAMPLE));
  Object.assign(data.weather[0].hourly[0], { chanceofrain: "0", chanceofovercast: "55", chanceofsunshine: "x", chanceoffog: "4", chanceofthunder: "9" });
  const cells = W.flatten(W.parseWttr(data, undefined));
  const row = cells.slice(11, 20);
  const byKind = row.filter((c) => c.kind === "pct");
  assert.deepEqual(byKind.map((c) => [c.text, c.dim]), [["55%", false], ["0%", true], ["–", true], [byKind[3].text, byKind[3].dim]]);
  const extra = row[8];
  assert.equal(extra.text, "Fog 4%   Thunder 9%");
  assert.ok(!extra.text.includes(","));
});

test("flatten: a failed or empty model produces no cells", () => {
  assert.deepEqual(W.flatten({ ok: false, error: "x" }), []);
  assert.deepEqual(W.flatten(null), []);
  assert.deepEqual(W.flatten(undefined), []);
  assert.deepEqual(W.flatten({ ok: true, days: [] }), []); // nothing to tabulate: not even a header
});

test("flatten: a day without slots still shows its title and summary", () => {
  const cells = W.flatten({ ok: true, days: [{ label: "Today", date: "d", hi: "1°C", lo: "0°C", sunrise: "07:00", sunset: "19:00", slots: [] }] });
  assert.equal(cells.length, 9 + 2);
});

// ---- fit: keep the panel within the space the screen has --------------------

const total = (m) => m.days.reduce((n, d) => n + d.slots.length, 0);
const lens = (m) => m.days.map((d) => d.slots.length);

test("fit: enough room changes nothing", () => {
  const m = W.parseWttr(SAMPLE, undefined);
  assert.deepEqual(lens(W.fit(m, 24)), [8, 8, 8]);
  assert.deepEqual(lens(W.fit(m, 100)), [8, 8, 8]);
});

test("fit: later days are thinned to every second slot before anything else is cut", () => {
  const m = W.parseWttr(SAMPLE, undefined);
  const a = W.fit(m, 20);
  assert.deepEqual(lens(a), [8, 8, 4]);
  assert.deepEqual(a.days[2].slots.map((s) => s.hour), ["0", "6", "12", "18"]);
  assert.deepEqual(lens(W.fit(m, 16)), [8, 4, 4]);
});

test("fit: today is never thinned, only cut from the end as a last resort", () => {
  const m = W.parseWttr(SAMPLE, undefined);
  const a = W.fit(m, 10);
  assert.ok(total(a) <= 10);
  assert.equal(a.days[0].slots[0].hour, "0"); // the soonest slot stays
  const b = W.fit(m, 5);
  assert.equal(total(b), 5);
  assert.deepEqual(lens(b), [5, 0, 0]);
  assert.deepEqual(b.days.map((d) => d.label).length, 3); // titles and summaries stay
});

test("fit: never drops below one slot, and tolerates junk limits", () => {
  const m = W.parseWttr(SAMPLE, undefined);
  assert.equal(total(W.fit(m, 1)), 1);
  assert.equal(total(W.fit(m, 0)), 24, "a limit below 1 is ignored");
  for (const bad of [undefined, null, NaN, -3, "8", {}]) assert.equal(total(W.fit(m, bad)), 24, String(bad));
});

test("fit: keeps every other field and does not mutate the input", () => {
  const m = W.parseWttr(SAMPLE, undefined);
  const before = JSON.stringify(m);
  const a = W.fit(m, 12);
  assert.equal(JSON.stringify(m), before);
  assert.equal(a.face, m.face); assert.equal(a.days[1].hi, m.days[1].hi); assert.equal(a.now.desc, m.now.desc);
});

test("fit: unusable models pass through, days with few slots are left alone", () => {
  assert.deepEqual(W.fit({ ok: false, error: "x" }, 5), { ok: false, error: "x" });
  assert.equal(W.fit(null, 5), null);
  const few = { ok: true, place: "", now: {}, face: "", days: [{ slots: [{ hour: "0" }, { hour: "3" }] }, { slots: [{ hour: "0" }, { hour: "3" }, { hour: "6" }] }] };
  assert.deepEqual(lens(W.fit(few, 4)), [2, 2]); // 3 slots: not thinned (only lists longer than 4 are), cut instead
});
