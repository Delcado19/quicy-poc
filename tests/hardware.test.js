const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load");
const B = load("core/lib/battery.js");
const K = load("core/lib/backlight.js");

// Material Design battery icons from Nerd Fonts (private use area).
const CHARGING = String.fromCodePoint(0xF0084); // battery with bolt
const BATTERY = String.fromCodePoint(0xF0079);  // battery without bolt
const PLUG = String.fromCodePoint(0xF06A5);     // plugged in, not charging

test("battery state thresholds and boundaries", () => {
  const s = (p, c) => B.stateFor(p, c);
  assert.equal(s(100, false), "normal");
  assert.equal(s(21, false), "normal");
  assert.equal(s(20, false), "warning");
  assert.equal(s(11, false), "warning");
  assert.equal(s(10, false), "critical");
  assert.equal(s(0, false), "critical");
  assert.equal(s(-5, false), "critical");
  assert.equal(s(150, false), "normal");
});

test("battery state: charging suppresses warnings; unknown input is normal", () => {
  assert.equal(B.stateFor(5, true), "normal");
  assert.equal(B.stateFor(5, "yes"), "critical");
  for (const bad of [NaN, Infinity, undefined, null, "50", {}]) assert.equal(B.stateFor(bad, false), "normal", String(bad));
});

test("parseBrightnessctl machine-readable output", () => {
  assert.equal(K.parseBrightnessctl("intel_backlight,backlight,48000,50%,96000"), 50);
  assert.equal(K.parseBrightnessctl("intel_backlight,backlight,96000,100%,96000\n"), 100);
  assert.equal(K.parseBrightnessctl("x,backlight,0,0%,96000"), 0);
  assert.equal(K.parseBrightnessctl("odd,name,backlight,480,5%,9600"), 5);
});

test("parseBrightnessctl rejects garbage", () => {
  for (const bad of [undefined, null, 5, "", "  ", "no backlight", "a,b,c", "a,b,c,50,e", "a,b,c,%,e", "a,b,c,101%,e",
                     "a,b,c,1000%,e", "a,b,c,-5%,e", "a,b,c,5.5%,e", "Device 'x' not found"]) {
    assert.equal(K.parseBrightnessctl(bad), null, String(bad));
  }
});

test("parseBrightnessctl only accepts the backlight class (machines without a backlight list LEDs)", () => {
  assert.equal(K.parseBrightnessctl("input3::capslock,leds,0,0%,1"), null);
  assert.equal(K.parseBrightnessctl("platform::micmute,leds,1,100%,1"), null);
  assert.equal(K.parseBrightnessctl("odd,name,backlight,480,5%,9600"), 5);
});

test("clampPercent bounds, rounding and invalid input", () => {
  assert.equal(K.clampPercent(50), 50);
  assert.equal(K.clampPercent(0), 1);
  assert.equal(K.clampPercent(-10), 1);
  assert.equal(K.clampPercent(100), 100);
  assert.equal(K.clampPercent(250), 100);
  assert.equal(K.clampPercent(49.6), 50);
  for (const bad of [NaN, Infinity, undefined, null, "50", {}]) assert.equal(K.clampPercent(bad), null, String(bad));
});

test("kindFor: charging, discharging and the plugged-in idle state", () => {
  assert.equal(B.kindFor(true, false), "charging");
  assert.equal(B.kindFor(false, true), "discharging");
  assert.equal(B.kindFor(false, false), "idle");
  // both flags cannot be true in UPower, but a conflicting input must still give one answer
  assert.equal(B.kindFor(true, true), "charging");
  for (const bad of [undefined, null, "yes", 1, {}]) assert.equal(B.kindFor(bad, bad), "idle", String(bad));
});

test("symbolFor: defaults, valid overrides and invalid overrides", () => {
  assert.deepEqual(["charging", "discharging", "idle"].map((k) => B.symbolFor(k)), [CHARGING, BATTERY, PLUG]);
  assert.equal(new Set([CHARGING, BATTERY, PLUG]).size, 3);
  assert.equal(B.symbolFor("charging", { charging: "+" }), "+");
  assert.equal(B.symbolFor("discharging", { charging: "+" }), BATTERY); // other kinds keep their default
  for (const bad of ["", "   ", 5, null, [], {}, "toolong-symbol"]) {
    assert.equal(B.symbolFor("charging", { charging: bad }), CHARGING, JSON.stringify(bad));
  }
  for (const bad of [undefined, null, "x", 5, []]) assert.equal(B.symbolFor("idle", bad), PLUG, JSON.stringify(bad));
  assert.equal(B.symbolFor("unknown-kind"), PLUG);
  assert.equal(B.symbolFor(undefined), PLUG);
});

test("symbolFor: a four-character symbol (e.g. an emoji pair) is the accepted maximum", () => {
  assert.equal(B.symbolFor("charging", { charging: "abcd" }), "abcd");
  assert.equal(B.symbolFor("charging", { charging: "abcde" }), CHARGING);
});

test("symbolFor never mutates the defaults or the override object", () => {
  const o = { charging: "+" };
  B.symbolFor("charging", o);
  B.symbolFor("idle", o);
  assert.deepEqual(o, { charging: "+" });
  assert.equal(B.symbolFor("charging"), CHARGING);
});

test("label: symbol, exactly one space, then the percentage", () => {
  assert.equal(B.label("charging", 98), CHARGING + " 98%");
  assert.equal(B.label("discharging", 5), BATTERY + " 5%");
  assert.equal(B.label("idle", 100), PLUG + " 100%");
  assert.equal(B.label("charging", 98, { charging: "+" }), "+ 98%");
});

test("label: boundaries, rounding and unreadable percentages", () => {
  assert.equal(B.label("idle", 0), PLUG + " 0%");
  assert.equal(B.label("idle", 97.6), PLUG + " 98%");
  assert.equal(B.label("idle", -3), PLUG + " 0%");
  assert.equal(B.label("idle", 140), PLUG + " 100%");
  for (const bad of [NaN, Infinity, undefined, null, "98", {}]) assert.equal(B.label("idle", bad), PLUG + " –", String(bad));
  assert.equal(B.label("nonsense", 50), PLUG + " 50%");
});

test("battery symbols tolerate shadowed methods, null prototypes and inherited keys", () => {
  const M = load("core/lib/modules.js");
  for (const value of [false, null, 0, "oops", {}]) {
    const parsed = M.parseModuleJson(JSON.stringify({ name: "battery", api: 1,
      options: { symbols: { hasOwnProperty: value, charging: "+" } } }));
    assert.deepEqual(parsed.problems, []);
    assert.equal(B.label("charging", 50, parsed.meta.options.symbols), "+ 50%");
    assert.equal(B.label("idle", 50, parsed.meta.options.symbols), PLUG + " 50%");
  }
  assert.equal(B.symbolFor("charging", Object.assign(Object.create(null), { charging: "+" })), "+");
  assert.equal(B.symbolFor("charging", Object.create({ charging: "+" })), CHARGING);
  for (const key of ["__proto__", "constructor", "hasOwnProperty"]) {
    assert.equal(B.symbolFor(key), PLUG);
  }
});
