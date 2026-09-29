const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("./load")("core/lib/modules.js");

test("valid and invalid module ids", () => {
  for (const ok of ["clock", "my-clock", "a", "A1_b-2", "x".repeat(64)]) assert.equal(M.isValidId(ok), true, ok);
  for (const bad of ["", ".", "..", "../etc", "a/b", "a\\b", "-x", "_x", "a b", "a.b", "x".repeat(65), undefined, null, 5, {}, [], "clock\n"]) {
    assert.equal(M.isValidId(bad), false, String(bad));
  }
});

test("candidates: user first, then shared; invalid ids yield none", () => {
  assert.deepEqual(M.candidates("clock", "/u", "/s"), ["/u/modules/clock", "/s/modules/clock"]);
  assert.deepEqual(M.candidates("../../etc", "/u", "/s"), []);
  assert.deepEqual(M.candidates("", "/u", "/s"), []);
});

test("candidates: empty or missing dirs are skipped, trailing slashes trimmed", () => {
  assert.deepEqual(M.candidates("c", "", "/s/"), ["/s/modules/c"]);
  assert.deepEqual(M.candidates("c", undefined, "/s"), ["/s/modules/c"]);
  assert.deepEqual(M.candidates("c", "/u//", ""), ["/u/modules/c"]);
  assert.deepEqual(M.candidates("c", "", ""), []);
});

test("parseModuleJson: minimal valid file gets defaults", () => {
  const r = M.parseModuleJson('{"name":"clock","api":1}');
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.meta, { name: "clock", api: 1, type: "bar", requires: [], options: {} });
});

test("parseModuleJson: full file", () => {
  const r = M.parseModuleJson('{"name":"w","api":2,"type":"window","requires":["Battery"],"options":{"command":["x"],"interval":5}}');
  assert.equal(r.meta.type, "window");
  assert.deepEqual(r.meta.options, { command: ["x"], interval: 5 });
});

test("parseModuleJson: missing, malformed and mistyped input yields null meta", () => {
  for (const v of [undefined, null, "", "  ", "{", "[]", "null", "5", "{}", '{"name":"","api":1}', '{"name":"x"}',
                   '{"name":"x","api":0}', '{"name":"x","api":1.5}', '{"name":"x","api":"1"}', '{"name":5,"api":1}',
                   '{"name":"x","api":1,"type":"popup"}', '{"name":"x","api":1,"requires":"Battery"}',
                   '{"name":"x","api":1,"requires":[1]}', '{"name":"x","api":1,"options":[]}']) {
    const r = M.parseModuleJson(v);
    assert.equal(r.meta, null, String(v));
    assert.ok(r.problems.length > 0, String(v));
  }
});

test("apiCompatible boundaries", () => {
  assert.equal(M.apiCompatible({ api: 1 }, 1), true);
  assert.equal(M.apiCompatible({ api: 2 }, 1), false);
  assert.equal(M.apiCompatible(null, 1), false);
  assert.equal(M.apiCompatible({ api: 1 }, undefined), false);
  assert.equal(M.apiCompatible({ api: 1 }, NaN), false);
});

const env = (o) => (k) => o[k];

test("userDir precedence and validation", () => {
  assert.equal(M.userDir(env({ QUICY_USER_DIR: "/x", XDG_CONFIG_HOME: "/c", HOME: "/h" })), "/x");
  assert.equal(M.userDir(env({ XDG_CONFIG_HOME: "/c", HOME: "/h" })), "/c/quicy");
  assert.equal(M.userDir(env({ HOME: "/h" })), "/h/.config/quicy");
  assert.equal(M.userDir(env({ QUICY_USER_DIR: "/x/", HOME: "/h" })), "/x");
});

test("userDir ignores empty, relative and non-string values", () => {
  assert.equal(M.userDir(env({ QUICY_USER_DIR: "rel", XDG_CONFIG_HOME: "", HOME: "/h" })), "/h/.config/quicy");
  assert.equal(M.userDir(env({ QUICY_USER_DIR: null, XDG_CONFIG_HOME: undefined, HOME: 5 })), "");
  assert.equal(M.userDir(env({})), "");
  assert.equal(M.userDir(env({ QUICY_USER_DIR: "/" })), "");
});

test("stateDir precedence and validation", () => {
  assert.equal(M.stateDir(env({ QUICY_STATE_DIR: "/s", XDG_STATE_HOME: "/x", HOME: "/h" })), "/s");
  assert.equal(M.stateDir(env({ XDG_STATE_HOME: "/x", HOME: "/h" })), "/x/quicy");
  assert.equal(M.stateDir(env({ HOME: "/h" })), "/h/.local/state/quicy");
  assert.equal(M.stateDir(env({ XDG_STATE_HOME: "state", HOME: "" })), "");
});
