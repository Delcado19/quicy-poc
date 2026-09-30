const test = require("node:test");
const assert = require("node:assert/strict");
const Z = require("./load")("core/lib/zone.js");

// Applying the plan to the current list must give exactly the (de-duplicated) target.
function check(current, next) {
  const ops = Z.syncPlan(current, next);
  assert.deepEqual(Z.applyPlan(current, ops), Z.unique(next), `${JSON.stringify(current)} -> ${JSON.stringify(next)}`);
  return ops;
}

test("identical lists need no operations", () => {
  assert.deepEqual(check(["a", "b"], ["a", "b"]), []);
  assert.deepEqual(check([], []), []);
});

test("insert at the end, at the start and in the middle", () => {
  check(["a"], ["a", "b"]);
  check(["b"], ["a", "b"]);
  check(["a", "c"], ["a", "b", "c"]);
});

test("remove from the start, the middle and the end, and everything", () => {
  check(["a", "b", "c"], ["b", "c"]);
  check(["a", "b", "c"], ["a", "c"]);
  check(["a", "b", "c"], ["a", "b"]);
  check(["a", "b", "c"], []);
});

test("unchanged entries are never removed or re-inserted", () => {
  const ops = check(["a", "b", "c"], ["a", "x", "c"]);
  assert.deepEqual(ops.filter((o) => o.op !== "remove" && o.op !== "insert").length, 0);
  assert.equal(ops.filter((o) => o.op === "remove").length, 1);
  assert.equal(ops.filter((o) => o.op === "insert").length, 1);
});

test("reordering moves entries instead of rebuilding them", () => {
  const ops = check(["a", "b", "c"], ["c", "a", "b"]);
  assert.ok(ops.every((o) => o.op === "move"));
  check(["a", "b", "c", "d"], ["d", "c", "b", "a"]);
});

test("mixed changes: remove, reorder and insert together", () => {
  check(["a", "b", "c", "d"], ["e", "d", "b"]);
  check(["a", "b"], ["c", "d", "e"]);
});

test("duplicates and non-string ids in the target are ignored, first occurrence wins", () => {
  assert.deepEqual(Z.unique(["a", "b", "a", "", 5, null, undefined, "b", "c"]), ["a", "b", "c"]);
  check(["a"], ["a", "a", "b", "b"]);
  check([], ["x", "x"]);
});

test("garbage input is treated as an empty list", () => {
  for (const bad of [undefined, null, "abc", 5, {}]) {
    assert.deepEqual(Z.unique(bad), []);
    assert.deepEqual(Z.syncPlan(bad, ["a"]).length, 1);
  }
  assert.deepEqual(check(["a"], undefined), [{ op: "remove", index: 0 }]); // an unusable target empties the zone
});

test("random sequences always converge to the target", () => {
  const pool = ["a", "b", "c", "d", "e", "f"];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = () => pool.filter(() => rnd() < 0.5).sort(() => rnd() - 0.5);
  for (let i = 0; i < 300; i++) check(pick(), pick());
});

test("the input arrays are not modified", () => {
  const cur = ["a", "b"], next = ["b", "c"];
  Z.syncPlan(cur, next);
  assert.deepEqual([cur, next], [["a", "b"], ["b", "c"]]);
});
