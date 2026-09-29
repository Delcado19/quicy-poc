const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load");
const B = load("core/lib/battery.js");
const K = load("core/lib/backlight.js");

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
