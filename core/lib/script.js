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

if (typeof module !== "undefined") module.exports = { parseScriptLine: parseScriptLine, lastLine: lastLine, nextBackoff: nextBackoff };
