.pragma library

var ZONES = ["left", "center", "right"];

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

// Keeps only valid keys; invalid ones are reported and dropped so that one typo
// does not discard the whole layout.
function cleanBlock(b, problems, where) {
    var out = {};
    if (!isObj(b)) {
        if (b !== undefined) problems.push(where + " must be an object");
        return out;
    }
    if (b.edge !== undefined) {
        if (b.edge === "top" || b.edge === "bottom") out.edge = b.edge;
        else problems.push(where + ".edge invalid: " + JSON.stringify(b.edge));
    }
    ZONES.forEach(function (z) {
        if (b[z] === undefined) return;
        var v = b[z];
        if (Array.isArray(v) && v.every(function (i) { return typeof i === "string" && i !== ""; })) out[z] = v.slice();
        else problems.push(where + "." + z + " must be an array of non-empty strings");
    });
    return out;
}

// Screen maps are null-prototype objects so monitor names like "__proto__"
// are plain keys.
function parseLayout(text) {
    var problems = [];
    var layout = { "default": {}, screens: Object.create(null) };
    if (typeof text !== "string" || text.trim() === "") return { layout: layout, problems: problems };
    var raw;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        problems.push("invalid JSON: " + e.message);
        return { layout: layout, problems: problems };
    }
    if (!isObj(raw)) {
        problems.push("root must be an object");
        return { layout: layout, problems: problems };
    }
    layout["default"] = cleanBlock(raw["default"], problems, "default");
    if (raw.screens !== undefined) {
        if (!isObj(raw.screens)) problems.push("screens must be an object");
        else Object.keys(raw.screens).forEach(function (n) {
            layout.screens[n] = cleanBlock(raw.screens[n], problems, "screens." + n);
        });
    }
    return { layout: layout, problems: problems };
}

function assign(target, src) {
    ["edge"].concat(ZONES).forEach(function (k) { if (src[k] !== undefined) target[k] = src[k]; });
    return target;
}

// The shipped layout is HyDE-owned and replaced on updates, the user layout is
// user-owned. A zone named by the user replaces the shipped zone wholesale:
// simple, predictable rules over clever merging.
function mergeLayout(shipped, user) {
    var m = {
        "default": assign(assign({ edge: "bottom", left: [], center: [], right: [] }, shipped["default"]), user["default"]),
        screens: Object.create(null)
    };
    [shipped, user].forEach(function (l) {
        Object.keys(l.screens).forEach(function (n) {
            m.screens[n] = assign(m.screens[n] || {}, l.screens[n]);
        });
    });
    return m;
}

function forScreen(m, name, extra, hidden) {
    var b = assign({}, m["default"]);
    if (typeof name === "string" && name !== "" && name in m.screens) assign(b, m.screens[name]);
    var hide = Object.create(null);
    (hidden || []).forEach(function (id) { hide[id] = true; });
    var present = ZONES.reduce(function (a, z) { return a.concat(b[z] || []); }, []);
    var extras = (extra || []).filter(function (id) {
        return typeof id === "string" && id !== "" && present.indexOf(id) < 0;
    });
    var problems = [];
    var seen = Object.create(null);
    ZONES.forEach(function (z) {
        var ids = (b[z] || []).slice();
        if (z === "right") ids = ids.concat(extras);
        b[z] = ids.filter(function (id) {
            if (hide[id]) return false;
            if (seen[id]) {
                problems.push("duplicate module id ignored: " + id);
                return false;
            }
            seen[id] = true;
            return true;
        });
    });
    b.problems = problems;
    return b;
}

function allIds(m) {
    var seen = Object.create(null);
    var out = [];
    function add(block) {
        ZONES.forEach(function (z) {
            (block[z] || []).forEach(function (id) {
                if (!seen[id]) { seen[id] = true; out.push(id); }
            });
        });
    }
    add(m["default"]);
    Object.keys(m.screens).forEach(function (n) { add(m.screens[n]); });
    return out;
}

// Include the default for future monitors as well as every configured override.
function commonIds(m) {
    var blocks = [forScreen(m, "")].concat(Object.keys(m.screens).map(function (name) { return forScreen(m, name); }));
    var ids = blocks.map(function (b) { return ZONES.reduce(function (out, z) { return out.concat(b[z]); }, []); });
    return ids[0].filter(function (id) { return ids.every(function (list) { return list.indexOf(id) >= 0; }); });
}

function copyState(s) { return { extra: s.extra.slice(), hidden: s.hidden.slice() }; }

// IPC "load": un-hides an id, and appends it to the right zone of every bar
// unless every effective layout already shows it. `inLayout` means common to
// the default and all screen layouts; forScreen skips extras already present.
function loadId(state, id, inLayout) {
    var s = copyState(state);
    var changed = false;
    var hi = s.hidden.indexOf(id);
    if (hi >= 0) { s.hidden.splice(hi, 1); changed = true; }
    if (!inLayout && s.extra.indexOf(id) < 0) { s.extra.push(id); changed = true; }
    return { state: s, changed: changed };
}

// IPC "unload": removes an IPC-loaded id, or hides an id the layout shows
// (anywhere) until the next reload. An id that is not shown at all is not
// recorded, otherwise a later load would only "undo" that phantom hide.
function unloadId(state, id, inLayout) {
    var s = copyState(state);
    var ei = s.extra.indexOf(id);
    if (ei >= 0) s.extra.splice(ei, 1);
    if (!inLayout || s.hidden.indexOf(id) >= 0) return { state: s, changed: ei >= 0 };
    s.hidden.push(id);
    return { state: s, changed: true };
}

if (typeof module !== "undefined") module.exports = {
    parseLayout: parseLayout, mergeLayout: mergeLayout, forScreen: forScreen,
    allIds: allIds, commonIds: commonIds, loadId: loadId, unloadId: unloadId
};
