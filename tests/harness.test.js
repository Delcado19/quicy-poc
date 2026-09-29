const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const load = require("./load");

function tmpLib(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quicy-"));
  fs.mkdirSync(path.join(dir, "core/lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "core/lib/x.js"), src);
  return dir;
}

test("load strips .pragma and returns exports", () => {
  const dir = tmpLib('.pragma library\nfunction f(){return 1}\nif (typeof module !== "undefined") module.exports = { f: f };\n');
  assert.equal(load("core/lib/x.js", dir).f(), 1);
});

test("load tolerates a file without exports guard", () => {
  const dir = tmpLib(".pragma library\nfunction f(){return 1}\n");
  assert.deepEqual(load("core/lib/x.js", dir), {});
});

test("load throws on a missing file", () => {
  assert.throws(() => load("core/lib/nope.js"));
});
