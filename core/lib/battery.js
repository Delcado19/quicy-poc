.pragma library

// Unknown values stay "normal": a missing reading must not raise an alarm.
function stateFor(percent, charging) {
    if (typeof percent !== "number" || !isFinite(percent)) return "normal";
    if (charging === true) return "normal";
    if (percent <= 10) return "critical";
    if (percent <= 20) return "warning";
    return "normal";
}

// One icon per power state (Material Design icons from Nerd Fonts, which HyDE
// installs; written as escapes because the private-use glyphs are invisible in
// editors without the font): battery with a bolt while charging, plain battery
// while discharging, power plug when plugged in without charging (full, or held
// back by a charge limit). Users can replace them through the module options.
var DEFAULT_SYMBOLS = { charging: "\udb80\udc84", discharging: "\udb80\udc79", idle: "\udb81\udea5" };

function kindFor(charging, discharging) {
    if (charging === true) return "charging";
    if (discharging === true) return "discharging";
    return "idle";
}

// `overrides` comes from the module's options, i.e. user-editable JSON: only
// short non-empty strings are accepted, anything else falls back per kind.
function symbolFor(kind, overrides) {
    var def = DEFAULT_SYMBOLS.hasOwnProperty(kind) ? DEFAULT_SYMBOLS[kind] : DEFAULT_SYMBOLS.idle;
    if (overrides === null || typeof overrides !== "object" || Array.isArray(overrides)) return def;
    var v = overrides.hasOwnProperty(kind) ? overrides[kind] : undefined;
    if (typeof v !== "string" || v.trim() === "" || Array.from(v).length > 4) return def;
    return v;
}

// Text shown in the bar: icon, one space, percentage.
function label(kind, percent, overrides) {
    var p = (typeof percent === "number" && isFinite(percent)) ? Math.round(Math.min(100, Math.max(0, percent))) + "%" : "\u2013";
    return symbolFor(kind, overrides) + " " + p;
}

if (typeof module !== "undefined") module.exports = { stateFor: stateFor, kindFor: kindFor, symbolFor: symbolFor, label: label };
