const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./load")("core/lib/theme.js");

const clone = (o) => JSON.parse(JSON.stringify(o));

test("empty, missing and non-string input is fatal and yields defaults", () => {
  for (const v of ["", "   \n", undefined, null, 42, {}, []]) {
    const r = T.parseTheme(v);
    assert.equal(r.fatal, true, String(v));
    assert.deepEqual(r.theme, T.DEFAULTS);
  }
});

test("malformed JSON and non-object roots are fatal", () => {
  for (const v of ['{"colors":', "[]", "null", '"str"', "123", "{"]) {
    assert.equal(T.parseTheme(v).fatal, true, v);
  }
});

test("a full valid theme is applied", () => {
  const full = { colors: { bg: "#000000", fg: "#ffffff", accent: "#123456", muted: "#111111", warning: "#222222", critical: "#333333" }, font: { family: "Inter", size: 14 }, radius: 4, spacing: 2 };
  const r = T.parseTheme(JSON.stringify(full));
  assert.equal(r.fatal, false);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.theme, full);
});

test("partial theme keeps defaults for the rest", () => {
  const r = T.parseTheme('{"colors":{"accent":"#abcdef"}}');
  assert.equal(r.theme.colors.accent, "#abcdef");
  assert.equal(r.theme.colors.bg, T.DEFAULTS.colors.bg);
  assert.equal(r.theme.radius, T.DEFAULTS.radius);
});

test("invalid colors fall back per field and are reported", () => {
  for (const bad of ["#12345", "red", "#gggggg", "123456", 5, null, "#1234567", "", true]) {
    const r = T.parseTheme(JSON.stringify({ colors: { accent: bad } }));
    assert.equal(r.theme.colors.accent, T.DEFAULTS.colors.accent, String(bad));
    assert.equal(r.problems.length, 1, String(bad));
    assert.equal(r.fatal, false);
  }
});

test("8-digit hex is CSS order #RRGGBBAA and is converted to QML's #AARRGGBB", () => {
  const bg = (v) => T.parseTheme(JSON.stringify({ colors: { bg: v } })).theme.colors.bg;
  assert.equal(bg("#11223380"), "#80112233");
  assert.equal(bg("#150A09CC"), "#CC150A09");
  assert.equal(bg("#aabbcc00"), "#00aabbcc"); // fully transparent stays transparent
  assert.equal(bg("#aabbccFF"), "#FFaabbcc");
  assert.equal(bg("#123456"), "#123456");     // 6 digits are untouched
});

test("font.size boundaries", () => {
  const size = (v) => T.parseTheme(JSON.stringify({ font: { size: v } })).theme.font.size;
  assert.equal(size(1), 1);
  assert.equal(size(200), 200);
  for (const bad of [0, -1, 201, "12", null, 1e9]) assert.equal(size(bad), T.DEFAULTS.font.size, String(bad));
});

test("font.family must be a non-empty string", () => {
  const fam = (v) => T.parseTheme(JSON.stringify({ font: { family: v } })).theme.font.family;
  assert.equal(fam("Inter"), "Inter");
  for (const bad of ["", "  ", 5, null, []]) assert.equal(fam(bad), T.DEFAULTS.font.family);
});

test("radius and spacing boundaries", () => {
  for (const k of ["radius", "spacing"]) {
    const get = (v) => T.parseTheme(JSON.stringify({ [k]: v }))["theme"][k];
    assert.equal(get(0), 0);
    assert.equal(get(1000), 1000);
    for (const bad of [-1, 1001, "8", null, [], {}]) assert.equal(get(bad), T.DEFAULTS[k], `${k} ${JSON.stringify(bad)}`);
  }
});

test("wrong container types are reported, not thrown", () => {
  for (const v of ['{"colors":[]}', '{"colors":"x"}', '{"font":[]}', '{"font":5}']) {
    const r = T.parseTheme(v);
    assert.equal(r.fatal, false, v);
    assert.equal(r.problems.length, 1, v);
    assert.deepEqual(r.theme, T.DEFAULTS);
  }
});

test("unknown keys are ignored", () => {
  const r = T.parseTheme('{"colors":{"neon":"#ffffff"},"shadow":3}');
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.theme, T.DEFAULTS);
});

test("parsing never mutates DEFAULTS and calls are independent", () => {
  const before = clone(T.DEFAULTS);
  const a = T.parseTheme('{"radius":1}');
  a.theme.colors.bg = "#000001";
  const b = T.parseTheme("{}");
  assert.deepEqual(T.DEFAULTS, before);
  assert.equal(b.theme.colors.bg, before.colors.bg);
});

test("pickTheme prefers the first usable source", () => {
  const r = T.pickTheme(['{"radius":1}', '{"radius":2}'], null);
  assert.equal(r.source, 0);
  assert.equal(r.theme.radius, 1);
});

test("pickTheme skips a missing (empty) source", () => {
  const r = T.pickTheme(["", '{"radius":2}'], null);
  assert.equal(r.source, 1);
  assert.equal(r.theme.radius, 2);
});

test("pickTheme keeps the last good theme when a present source is broken (mid-write)", () => {
  const last = T.parseTheme('{"radius":7}').theme;
  const r = T.pickTheme(['{"radius":', '{"radius":2}'], last);
  assert.equal(r.source, -1);
  assert.equal(r.theme.radius, 7);
  assert.ok(r.problems.length > 0);
});

test("pickTheme without a last-good theme falls through to the next source", () => {
  const r = T.pickTheme(['{"radius":', '{"radius":2}'], null);
  assert.equal(r.source, 1);
});

test("pickTheme with nothing usable returns last-good, else defaults", () => {
  const last = T.parseTheme('{"radius":7}').theme;
  assert.equal(T.pickTheme(["", undefined], last).theme.radius, 7);
  assert.deepEqual(T.pickTheme([], null).theme, T.DEFAULTS);
  assert.deepEqual(T.pickTheme(["", ""], null).theme, T.DEFAULTS);
});
