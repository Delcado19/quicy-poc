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
