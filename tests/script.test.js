const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./load")("core/lib/script.js");

const EMPTY = { text: "", alt: "", tooltip: "", classes: [] };

test("a valid waybar-style line is normalized", () => {
  const r = S.parseScriptLine('{"text":"21°C","alt":"sun","tooltip":"Bielefeld","class":"warning night"}', null);
  assert.equal(r.error, null);
  assert.deepEqual(r.value, { text: "21°C", alt: "sun", tooltip: "Bielefeld", classes: ["warning", "night"] });
});

test("missing fields default to empty; class may be an array", () => {
  assert.deepEqual(S.parseScriptLine("{}", null).value, EMPTY);
  assert.deepEqual(S.parseScriptLine('{"class":["a","b",5]}', null).value.classes, ["a", "b"]);
});

test("numbers and booleans in text fields are stringified", () => {
  assert.equal(S.parseScriptLine('{"text":42}', null).value.text, "42");
  assert.equal(S.parseScriptLine('{"text":false}', null).value.text, "false");
});

test("errors keep the last valid value", () => {
  const last = { text: "old", alt: "", tooltip: "", classes: [] };
  const bad = ["", "   ", undefined, null, 5, "not json", "{", "[]", "null", '"s"', "7",
               '{"text":{}}', '{"text":[1]}', '{"alt":null}', '{"tooltip":{"a":1}}', '{"class":5}', '{"class":{}}'];
  for (const v of bad) {
    const r = S.parseScriptLine(v, last);
    assert.notEqual(r.error, null, String(v));
    assert.equal(r.value, last, String(v));
  }
});

test("errors without a last value return an empty value", () => {
  assert.deepEqual(S.parseScriptLine("garbage", null).value, EMPTY);
  assert.deepEqual(S.parseScriptLine("garbage", undefined).value, EMPTY);
});

test("line length boundary", () => {
  const pad = (n) => JSON.stringify({ text: "x".repeat(n) });
  const ok = 65536 - JSON.stringify({ text: "" }).length;
  assert.equal(S.parseScriptLine(pad(ok), null).error, null);
  assert.notEqual(S.parseScriptLine(pad(ok + 1), null).error, null);
});

test("lastLine picks the last non-empty line and tolerates CRLF and blanks", () => {
  assert.equal(S.lastLine('{"a":1}\n{"b":2}\n'), '{"b":2}');
  assert.equal(S.lastLine('x\r\n\r\ny\r\n\r\n'), "y");
  for (const v of ["", "\n\n", undefined, null, 5]) assert.equal(S.lastLine(v), "");
});

test("nextBackoff doubles, starts at 1000 and caps at 60000", () => {
  assert.equal(S.nextBackoff(1000), 2000);
  assert.equal(S.nextBackoff(32000), 60000);
  assert.equal(S.nextBackoff(60000), 60000);
  assert.equal(S.nextBackoff(1e9), 60000);
  for (const bad of [0, -5, NaN, Infinity, undefined, null, "1000"]) assert.equal(S.nextBackoff(bad), 1000, String(bad));
});
