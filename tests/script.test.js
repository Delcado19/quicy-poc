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

test("restartPlan: short runs keep growing the backoff, stable runs reset it", () => {
  assert.deepEqual(S.restartPlan(1000, 0), { delay: 1000, next: 2000 });
  assert.deepEqual(S.restartPlan(4000, 500), { delay: 4000, next: 8000 });
  assert.deepEqual(S.restartPlan(32000, 9999), { delay: 32000, next: 60000 });
  assert.deepEqual(S.restartPlan(32000, 10000), { delay: 1000, next: 2000 });
  assert.deepEqual(S.restartPlan(60000, 120000), { delay: 1000, next: 2000 });
});

test("restartPlan: invalid input counts as a short run from the base delay", () => {
  for (const runMs of [NaN, undefined, null, -5, "20000", Infinity]) {
    assert.deepEqual(S.restartPlan(4000, runMs), { delay: 4000, next: 8000 }, String(runMs));
  }
  for (const prev of [0, -1, NaN, undefined, null]) {
    assert.deepEqual(S.restartPlan(prev, 0), { delay: 1000, next: 2000 }, String(prev));
  }
});

test("clampInterval: 0 stays a stream, tiny values get a floor, junk becomes a stream", () => {
  assert.equal(S.clampInterval(0), 0);
  assert.equal(S.clampInterval(1), 1000);
  assert.equal(S.clampInterval(999), 1000);
  assert.equal(S.clampInterval(1000), 1000);
  assert.equal(S.clampInterval(3600000), 3600000);
  for (const bad of [-1, NaN, undefined, null, "5000", Infinity, 1.5]) assert.equal(S.clampInterval(bad), bad === 1.5 ? 1000 : 0, String(bad));
});

test("exitNote reports a run that produced no valid line", () => {
  assert.equal(S.exitNote(true, 0), "");
  assert.equal(S.exitNote(true, 1), "");
  assert.match(S.exitNote(false, 0), /no output/);
  assert.match(S.exitNote(false, 7), /exit code 7/);
  assert.match(S.exitNote(false, undefined), /no output/);
  assert.match(S.exitNote(false, 124), /timed out/);
});

test("tooltipMarkup: plain text and line breaks", () => {
  assert.equal(S.tooltipMarkup("plain"), "plain");
  assert.equal(S.tooltipMarkup("a\nb"), "a<br/>b");
  assert.equal(S.tooltipMarkup("a\r\nb\rc"), "a<br/>b<br/>c");
});

test("tooltipMarkup keeps only b, i, u and br tags", () => {
  assert.equal(S.tooltipMarkup("<b>Overcast  21°C</b>\nFeels like: 19°C"), "<b>Overcast  21°C</b><br/>Feels like: 19°C");
  assert.equal(S.tooltipMarkup("<i>x</i><u>y</u><br>z<br/>w"), "<i>x</i><u>y</u><br/>z<br/>w");
  assert.equal(S.tooltipMarkup("<B>loud</B>"), "<b>loud</b>");
});

test("tooltipMarkup escapes every other tag, also tags with attributes", () => {
  assert.equal(S.tooltipMarkup('<a href="x">y</a>'), '&lt;a href="x"&gt;y&lt;/a&gt;');
  assert.equal(S.tooltipMarkup('<b onclick="x">y</b>'), '&lt;b onclick="x"&gt;y</b>');
  assert.equal(S.tooltipMarkup("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.equal(S.tooltipMarkup("<img src=x>"), "&lt;img src=x&gt;");
});

test("tooltipMarkup escapes bare < > & but keeps real entities", () => {
  assert.equal(S.tooltipMarkup("a < b & c > d"), "a &lt; b &amp; c &gt; d");
  assert.equal(S.tooltipMarkup("Tom &amp; Jerry &lt;3 &#176; &#x00B0;"), "Tom &amp; Jerry &lt;3 &#176; &#x00B0;");
  assert.equal(S.tooltipMarkup("&nosuch; & &"), "&amp;nosuch; &amp; &amp;");
});

test("tooltipMarkup: empty, non-string and whitespace-only input give an empty string", () => {
  for (const v of ["", "   ", "\n\n", undefined, null, 5, {}, []]) assert.equal(S.tooltipMarkup(v), "", String(v));
});

test("tooltipMarkup caps length and number of lines", () => {
  const long = S.tooltipMarkup("x".repeat(10000));
  assert.ok(long.length <= 4001 && long.endsWith("…"));
  const many = S.tooltipMarkup(Array.from({ length: 100 }, (_, i) => "l" + i).join("\n"));
  assert.equal(many.split("<br/>").length, 41); // 40 lines plus the ellipsis line
  assert.ok(many.endsWith("…"));
  assert.equal(S.tooltipMarkup("x".repeat(4000)), "x".repeat(4000)); // exactly at the limit is untouched
});
