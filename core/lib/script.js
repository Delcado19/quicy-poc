.pragma library

var MAX_LINE = 65536;

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

function scalar(v) {
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return null;
}

// HyDE scripts print Waybar-style JSON (text/alt/tooltip/class). On any error
// the previous valid value is kept so a flaky script does not blank the bar.
function parseScriptLine(line, last) {
    var keep = last || { text: "", alt: "", tooltip: "", classes: [] };
    function fail(msg) { return { value: keep, error: msg }; }
    if (typeof line !== "string" || line.trim() === "") return fail("empty output");
    if (line.length > MAX_LINE) return fail("line too long");
    var raw;
    try {
        raw = JSON.parse(line);
    } catch (e) {
        return fail("invalid JSON: " + e.message);
    }
    if (!isObj(raw)) return fail("JSON root must be an object");
    var text = raw.text === undefined ? "" : scalar(raw.text);
    var alt = raw.alt === undefined ? "" : scalar(raw.alt);
    var tooltip = raw.tooltip === undefined ? "" : scalar(raw.tooltip);
    if (text === null || alt === null || tooltip === null) return fail("text, alt and tooltip must be scalar");
    var classes = [];
    var c = raw["class"];
    if (typeof c === "string") classes = c.split(/\s+/).filter(function (s) { return s !== ""; });
    else if (Array.isArray(c)) classes = c.filter(function (s) { return typeof s === "string" && s !== ""; });
    else if (c !== undefined) return fail("class must be a string or an array");
    return { value: { text: text, alt: alt, tooltip: tooltip, classes: classes }, error: null };
}

function lastLine(text) {
    if (typeof text !== "string") return "";
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    return lines.length ? lines[lines.length - 1] : "";
}

// Restart delay for a script that keeps dying: doubles up to one minute so a
// crash loop cannot spin the CPU.
function nextBackoff(prev) {
    if (typeof prev !== "number" || !isFinite(prev) || prev <= 0) return 1000;
    return Math.min(prev * 2, 60000);
}

// A run that lasted this long counts as healthy: only then the restart delay
// starts over. Resetting on every valid line would restart a one-shot script
// that prints a line and exits (e.g. a weather fetch used without an interval)
// once per second, forever.
var STABLE_MS = 10000;

function restartPlan(prev, runMs) {
    var base = (typeof prev === "number" && isFinite(prev) && prev > 0) ? prev : 1000;
    if (typeof runMs === "number" && isFinite(runMs) && runMs >= STABLE_MS) base = 1000;
    return { delay: base, next: nextBackoff(base) };
}

// 0 means "long-running stream". Anything else is a polling interval with a
// floor of one second so a typo cannot fork a process back-to-back.
function clampInterval(ms) {
    if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return 0;
    return Math.max(1000, Math.round(ms));
}

// Explains a periodic run that ended without producing a valid line, so the
// bar does not present old data as current.
function exitNote(gotLine, code) {
    if (gotLine) return "";
    if (code === 124) return "timed out";
    if (typeof code === "number" && code !== 0) return "no output (exit code " + code + ")";
    return "no output";
}

var MAX_TIP_CHARS = 4000;
var MAX_TIP_LINES = 40;

// Scripts print Pango-style tooltips (<b>, newlines). The text may contain
// data from the internet (weather location names), so it is turned into
// StyledText markup that only allows b, i, u and line breaks: every other tag
// is shown as text, real entities (&amp; &#176;) survive, a bare & < > is
// escaped. Length and line count are capped so a runaway script cannot build
// a screen-sized popup.
function tooltipMarkup(text) {
    if (typeof text !== "string" || text.trim() === "") return "";
    var t = text.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
    if (t.length > MAX_TIP_CHARS) t = t.slice(0, MAX_TIP_CHARS) + "\u2026";
    var lines = t.split("\n");
    if (lines.length > MAX_TIP_LINES) t = lines.slice(0, MAX_TIP_LINES).join("\n") + "\n\u2026";
    return t.replace(/<\/?(?:b|i|u)>|<br\s*\/?>|&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);|[<>&]|\n/gi, function (m) {
        if (m === "\n") return "<br/>";
        if (m === "<") return "&lt;";
        if (m === ">") return "&gt;";
        if (m === "&") return "&amp;";
        if (m.charAt(0) === "&") return m;
        return /^<br/i.test(m) ? "<br/>" : m.toLowerCase();
    });
}

if (typeof module !== "undefined") module.exports = { parseScriptLine: parseScriptLine, lastLine: lastLine, nextBackoff: nextBackoff, restartPlan: restartPlan, clampInterval: clampInterval, exitNote: exitNote, tooltipMarkup: tooltipMarkup };
