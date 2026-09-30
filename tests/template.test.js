const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = require("./load")("core/lib/theme.js");

const TEMPLATE = path.join(__dirname, "..", "adapters", "hyde", "quicy.dcol");

// wallbash derives the nine accents xa1..xa9 of every primary from that
// primary's hue, so two primaries with similar hues yield identical accents.
// This palette is a real one with exactly that property (1xa6 == 3xa6).
const SAME_HUE = { pry1: "150A09", txt1: "FFFFFF", "1xa7": "E6A09A", "1xa8": "F0B0AA", "1xa6": "C2807A", "3xa6": "C2807A" };

function render(palette) {
  const body = fs.readFileSync(TEMPLATE, "utf8").split("\n").slice(1).join("\n"); // line 1 is "target|command"
  return body.replace(/<wallbash_([0-9a-z]+)>/g, (m, key) => {
    assert.ok(key in palette, `template uses unknown placeholder ${m}`);
    return palette[key];
  });
}

test("the template renders valid JSON that the theme parser accepts without complaints", () => {
  const r = T.parseTheme(render(SAME_HUE));
  assert.equal(r.fatal, false);
  assert.deepEqual(r.problems, []);
});

test("warning and critical stay distinguishable from the accent colours, whatever the wallpaper", () => {
  const c = T.parseTheme(render(SAME_HUE)).theme.colors;
  const values = [c.accent, c.muted, c.warning, c.critical].map((v) => v.toLowerCase());
  assert.equal(new Set(values).size, 4, `accent/muted/warning/critical must all differ: ${values}`);
  assert.notEqual(c.warning.toLowerCase(), c.bg.toLowerCase());
  assert.notEqual(c.critical.toLowerCase(), c.fg.toLowerCase());
});

test("the header line names a target and no command", () => {
  const [target, command] = fs.readFileSync(TEMPLATE, "utf8").split("\n")[0].split("|");
  assert.match(target, /\/quicy\/theme\.json$/);
  assert.equal(command, "");
});

test("every colour placeholder resolves for a palette with only the documented keys", () => {
  assert.doesNotThrow(() => render(SAME_HUE));
});

function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: ((h * 60) + 360) % 360, s, l };
}

test("critical is a recognisable red on every palette, not a tint of the wallpaper hue", () => {
  // Wallpaper palettes with blue, green and red dominant hues: critical must not follow them.
  const palettes = [SAME_HUE, { ...SAME_HUE, "1xa8": "AAB8F0" }, { ...SAME_HUE, "1xa8": "AAF0B4" }];
  for (const p of palettes) {
    const { h, s, l } = hsl(T.parseTheme(render(p)).theme.colors.critical);
    assert.ok(h <= 12 || h >= 348, `hue ${h.toFixed(0)} is not red`);
    assert.ok(s >= 0.6, `saturation ${s.toFixed(2)} too low`);
    assert.ok(l >= 0.4 && l <= 0.7, `lightness ${l.toFixed(2)} unreadable on dark or light backgrounds`);
  }
});

test("warning (amber) and critical (red) are far apart in hue", () => {
  const c = T.parseTheme(render(SAME_HUE)).theme.colors;
  const dh = Math.abs(hsl(c.warning).h - hsl(c.critical).h);
  assert.ok(Math.min(dh, 360 - dh) >= 20, `hue distance ${dh.toFixed(0)}`);
});
