const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("./load")("core/lib/layout.js");

const parse = (o) => L.parseLayout(typeof o === "string" ? o : JSON.stringify(o)).layout;
const SHIPPED = { default: { edge: "bottom", right: ["battery", "backlight", "weather"] }, screens: { "eDP-1": { right: ["battery"] } } };

test("empty and undefined text is a normal empty layout, not a problem", () => {
  for (const v of ["", "  ", undefined, null]) {
    const r = L.parseLayout(v);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.layout.default, {});
  }
});

test("malformed JSON and wrong root types are reported and yield an empty layout", () => {
  for (const v of ["{", "[]", "null", "5", '"x"']) {
    const r = L.parseLayout(v);
    assert.ok(r.problems.length > 0, v);
    assert.deepEqual(r.layout.default, {});
  }
});

test("invalid edge, zone types and zone entries are dropped per field", () => {
  const r = L.parseLayout(JSON.stringify({ default: { edge: "left", left: "x", center: [1], right: ["ok", ""] } }));
  assert.deepEqual(r.layout.default, {});
  assert.equal(r.problems.length, 4);
});

test("screens must be an object and each screen block an object", () => {
  assert.ok(L.parseLayout('{"screens":[]}').problems.length > 0);
  const r = L.parseLayout('{"screens":{"DP-1":5,"DP-2":{"right":["a"]}}}');
  assert.equal(r.problems.length, 1);
  const m = L.mergeLayout(parse({}), r.layout);
  assert.deepEqual(L.forScreen(m, "DP-2").right, ["a"]);
});

test("merge: user zone replaces the shipped zone wholesale, other zones stay", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({ default: { right: ["my-clock"] } }));
  const b = L.forScreen(m, "HDMI-A-1");
  assert.deepEqual(b.right, ["my-clock"]);
  assert.equal(b.edge, "bottom");
  assert.deepEqual(b.left, []);
});

test("merge: user edge overrides, an empty user zone empties the zone", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({ default: { edge: "top", right: [] } }));
  const b = L.forScreen(m, "x");
  assert.equal(b.edge, "top");
  assert.deepEqual(b.right, []);
});

test("merge with two empty layouts still has a complete default", () => {
  const b = L.forScreen(L.mergeLayout(parse({}), parse({})), "x");
  assert.deepEqual([b.edge, b.left, b.center, b.right], ["bottom", [], [], []]);
});

test("per-screen overrides only the zones it names", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({ screens: { "DP-1": { center: ["weather"] } } }));
  const dp = L.forScreen(m, "DP-1");
  assert.deepEqual(dp.center, ["weather"]);
  // "weather" is now also in center, so the duplicate rule drops it from right.
  assert.deepEqual(dp.right, ["battery", "backlight"]);
  assert.equal(dp.problems.length, 1);
});

test("shipped and user screen blocks are merged per zone", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({ screens: { "eDP-1": { center: ["c"] } } }));
  const b = L.forScreen(m, "eDP-1");
  assert.deepEqual(b.right, ["battery"]);
  assert.deepEqual(b.center, ["c"]);
});

test("unknown, empty, undefined and non-string screen names use the default", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({}));
  for (const n of ["nope", "", undefined, null, 5, {}]) {
    assert.deepEqual(L.forScreen(m, n).right, ["battery", "backlight", "weather"], String(n));
  }
});

test("prototype-ish screen names cannot pollute or crash", () => {
  const m = L.mergeLayout(parse({}), parse('{"screens":{"__proto__":{"right":["x"]}}}'));
  assert.deepEqual(L.forScreen(m, "__proto__").right, ["x"]);
  assert.deepEqual(L.forScreen(m, "constructor").right, []);
  assert.equal(({}).right, undefined);
});

test("duplicate ids: first wins across zones, reported", () => {
  const m = L.mergeLayout(parse({ default: { left: ["a"], center: ["b", "a"], right: ["b", "c", "c"] } }), parse({}));
  const b = L.forScreen(m, "x");
  assert.deepEqual([b.left, b.center, b.right], [["a"], ["b"], ["c"]]);
  assert.equal(b.problems.length, 3);
});

test("extra ids are appended to right, skipped when already present, invalid ones ignored", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({}));
  const b = L.forScreen(m, "x", ["clock", "battery", "", 5, null], []);
  assert.deepEqual(b.right, ["battery", "backlight", "weather", "clock"]);
  assert.deepEqual(b.problems, []);
});

test("hidden ids are removed everywhere, also layout ones", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({}));
  assert.deepEqual(L.forScreen(m, "x", [], ["weather", "nope"]).right, ["battery", "backlight"]);
  assert.deepEqual(L.forScreen(m, "x", ["clock"], ["clock"]).right, ["battery", "backlight", "weather"]);
});

test("forScreen tolerates undefined extra/hidden", () => {
  assert.doesNotThrow(() => L.forScreen(L.mergeLayout(parse({}), parse({})), "x", undefined, undefined));
});

test("allIds collects default and screen ids uniquely", () => {
  const m = L.mergeLayout(parse(SHIPPED), parse({ screens: { "DP-1": { center: ["weather", "x"] } } }));
  assert.deepEqual(L.allIds(m).sort(), ["backlight", "battery", "weather", "x"]);
});

test("loadId/unloadId state transitions", () => {
  let s = { extra: [], hidden: [] };
  let r = L.loadId(s, "clock", false);
  assert.deepEqual([r.changed, r.state.extra], [true, ["clock"]]);
  r = L.loadId(r.state, "clock", false);
  assert.equal(r.changed, false);
  r = L.loadId(r.state, "battery", true);
  assert.equal(r.changed, false);
  r = L.unloadId(r.state, "clock");
  assert.deepEqual([r.changed, r.state.extra, r.state.hidden], [true, [], []]);
  r = L.unloadId(r.state, "battery");
  assert.deepEqual([r.changed, r.state.hidden], [true, ["battery"]]);
  r = L.unloadId(r.state, "battery");
  assert.equal(r.changed, false);
  r = L.loadId(r.state, "battery", true);
  assert.deepEqual([r.changed, r.state.hidden], [true, []]);
});

test("state transitions do not mutate their input", () => {
  const s = { extra: ["a"], hidden: [] };
  L.loadId(s, "b", false);
  L.unloadId(s, "a");
  assert.deepEqual(s, { extra: ["a"], hidden: [] });
});
