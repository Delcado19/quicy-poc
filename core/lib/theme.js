.pragma library

var DEFAULTS = {
    colors: { bg: "#1e1e2e", fg: "#cdd6f4", accent: "#89b4fa", muted: "#6c7086", warning: "#f9e2af", critical: "#f38ba8" },
    font: { family: "sans", size: 12 },
    radius: 8,
    spacing: 6
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function isColor(v) { return typeof v === "string" && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v); }
function isNum(v, min, max) { return typeof v === "number" && isFinite(v) && v >= min && v <= max; }

// Never throws: a bad theme must not take the shell down. Every invalid field
// falls back to its default and is reported in `problems`; `fatal` means the
// whole text was unusable (empty, not JSON, not an object).
function parseTheme(text) {
    var out = { theme: clone(DEFAULTS), problems: [], fatal: false };
    var raw;
    if (typeof text !== "string" || text.trim() === "") {
        out.problems.push("empty or missing theme");
        out.fatal = true;
        return out;
    }
    try {
        raw = JSON.parse(text);
    } catch (e) {
        out.problems.push("invalid JSON: " + e.message);
        out.fatal = true;
        return out;
    }
    if (!isObj(raw)) {
        out.problems.push("root must be an object");
        out.fatal = true;
        return out;
    }
    if (raw.colors !== undefined) {
        if (!isObj(raw.colors)) out.problems.push("colors must be an object");
        else Object.keys(DEFAULTS.colors).forEach(function (k) {
            var v = raw.colors[k];
            if (v === undefined) return;
            if (isColor(v)) out.theme.colors[k] = v;
            else out.problems.push("colors." + k + " invalid: " + JSON.stringify(v));
        });
    }
    if (raw.font !== undefined) {
        if (!isObj(raw.font)) out.problems.push("font must be an object");
        else {
            if (raw.font.family !== undefined) {
                if (typeof raw.font.family === "string" && raw.font.family.trim() !== "") out.theme.font.family = raw.font.family;
                else out.problems.push("font.family invalid");
            }
            if (raw.font.size !== undefined) {
                if (isNum(raw.font.size, 1, 200)) out.theme.font.size = raw.font.size;
                else out.problems.push("font.size invalid: " + JSON.stringify(raw.font.size));
            }
        }
    }
    ["radius", "spacing"].forEach(function (k) {
        if (raw[k] === undefined) return;
        if (isNum(raw[k], 0, 1000)) out.theme[k] = raw[k];
        else out.problems.push(k + " invalid: " + JSON.stringify(raw[k]));
    });
    return out;
}

// `texts` are ordered by priority (generated theme, shipped example).
// An empty/missing source is skipped. A source that is present but unparsable
// is usually a file caught mid-write (wallbash rewrites it on every theme
// change); if a previous good theme exists we keep it instead of flashing
// the lower-priority source or the defaults.
function pickTheme(texts, last) {
    for (var i = 0; i < texts.length; i++) {
        var r = parseTheme(texts[i]);
        if (!r.fatal) return { theme: r.theme, source: i, problems: r.problems };
        var present = typeof texts[i] === "string" && texts[i].trim() !== "";
        if (present && last) return { theme: last, source: -1, problems: ["source " + i + " unusable, keeping last good theme: " + r.problems.join("; ")] };
    }
    if (last) return { theme: last, source: -1, problems: ["no usable theme source, keeping last good theme"] };
    return { theme: clone(DEFAULTS), source: -1, problems: ["no usable theme source, using defaults"] };
}

if (typeof module !== "undefined") module.exports = { DEFAULTS: DEFAULTS, parseTheme: parseTheme, pickTheme: pickTheme };
