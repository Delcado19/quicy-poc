.pragma library

// Unknown values stay "normal": a missing reading must not raise an alarm.
function stateFor(percent, charging) {
    if (typeof percent !== "number" || !isFinite(percent)) return "normal";
    if (charging === true) return "normal";
    if (percent <= 10) return "critical";
    if (percent <= 20) return "warning";
    return "normal";
}

if (typeof module !== "undefined") module.exports = { stateFor: stateFor };
