.pragma library

// `brightnessctl -m` prints "device,class,current,percent,max". The percent is
// taken from the end because device names may contain commas.
function parseBrightnessctl(line) {
    if (typeof line !== "string") return null;
    var f = line.trim().split(",");
    if (f.length < 5) return null;
    var m = /^(\d{1,3})%$/.exec(f[f.length - 2]);
    if (!m) return null;
    var p = parseInt(m[1], 10);
    return p <= 100 ? p : null;
}

// Minimum 1 so a scroll-down can never turn the screen fully black.
function clampPercent(p) {
    if (typeof p !== "number" || !isFinite(p)) return null;
    return Math.min(100, Math.max(1, Math.round(p)));
}

if (typeof module !== "undefined") module.exports = { parseBrightnessctl: parseBrightnessctl, clampPercent: clampPercent };
