.pragma library

var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

// Ids end up in file paths (layout file and IPC are both untrusted input), so
// anything with a separator or leading dot is rejected before a path is built.
function isValidId(id) { return typeof id === "string" && ID_RE.test(id); }

function cleanDir(d) { return typeof d === "string" ? d.replace(/\/+$/, "") : ""; }

// User dir first: a user module with the same id overrides the shipped one.
function candidates(id, userDir, sharedDir) {
    if (!isValidId(id)) return [];
    var out = [];
    [cleanDir(userDir), cleanDir(sharedDir)].forEach(function (d) {
        if (d !== "") out.push(d + "/modules/" + id);
    });
    return out;
}

function parseModuleJson(text) {
    var problems = [];
    var raw;
    if (typeof text !== "string" || text.trim() === "") return { meta: null, problems: ["empty or missing module.json"] };
    try {
        raw = JSON.parse(text);
    } catch (e) {
        return { meta: null, problems: ["invalid JSON: " + e.message] };
    }
    if (!isObj(raw)) return { meta: null, problems: ["root must be an object"] };
    if (typeof raw.name !== "string" || raw.name === "") problems.push("name must be a non-empty string");
    if (!Number.isInteger(raw.api) || raw.api < 1) problems.push("api must be an integer >= 1");
    var type = raw.type === undefined ? "bar" : raw.type;
    if (type !== "bar" && type !== "window") problems.push("type must be \"bar\" or \"window\"");
    var requires = raw.requires === undefined ? [] : raw.requires;
    if (!Array.isArray(requires) || !requires.every(function (r) { return typeof r === "string"; })) problems.push("requires must be an array of strings");
    var options = raw.options === undefined ? {} : raw.options;
    if (!isObj(options)) problems.push("options must be an object");
    if (problems.length > 0) return { meta: null, problems: problems };
    return { meta: { name: raw.name, api: raw.api, type: type, requires: requires, options: options }, problems: [] };
}

function apiCompatible(meta, hostApi) {
    return meta !== null && meta !== undefined && Number.isInteger(hostApi) && Number.isInteger(meta.api) && meta.api <= hostApi;
}

function abs(p) { return typeof p === "string" && p.charAt(0) === "/"; }

// `get` is injected so tests do not depend on the real environment.
// Relative values are ignored: a relative config dir would silently move with
// the shell's working directory.
function userDir(get) {
    var o = get("QUICY_USER_DIR");
    if (abs(o)) return cleanDir(o);
    var x = get("XDG_CONFIG_HOME");
    if (abs(x)) return cleanDir(x) + "/quicy";
    var h = get("HOME");
    if (abs(h)) return cleanDir(h) + "/.config/quicy";
    return "";
}

function stateDir(get) {
    var o = get("QUICY_STATE_DIR");
    if (abs(o)) return cleanDir(o);
    var x = get("XDG_STATE_HOME");
    if (abs(x)) return cleanDir(x) + "/quicy";
    var h = get("HOME");
    if (abs(h)) return cleanDir(h) + "/.local/state/quicy";
    return "";
}

if (typeof module !== "undefined") module.exports = {
    isValidId: isValidId, candidates: candidates, parseModuleJson: parseModuleJson,
    apiCompatible: apiCompatible, userDir: userDir, stateDir: stateDir
};
