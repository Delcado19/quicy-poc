.pragma library

// Everything the weather table needs from wttr.in, already formatted: the
// panel only lays the strings out in columns. Ranges follow the design brief:
// temperatures are shown between -99 and 99 degrees, percentages between 0 and
// 100, so the column widths can be fixed to "-99°C" and "100%".

// Same mapping HyDE's weather.py uses, so the bar matches Waybar.
var ICONS = {};
[["☀️", ["113"]],
 ["⛅", ["116"]],
 ["☁️", ["119", "122", "143", "149", "248", "260"]],
 ["🌧️", ["176", "179", "182", "185", "263", "266", "281", "284", "293", "296", "299", "302", "305", "308", "311", "314", "317", "350", "353", "356", "359", "362", "365", "368", "392"]],
 ["⛈️", ["200"]],
 ["🌨️", ["227", "230", "320", "323", "326", "374", "377", "386", "389"]],
 ["❄️", ["329", "332", "335", "338", "371", "395"]]
].forEach(function (e) { e[1].forEach(function (c) { ICONS[c] = e[0]; }); });

var DASH = "–";

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

// A number from a number or a plain numeric string; NaN for anything else
// (so "12abc", "", [] and null never turn into 12 or 0).
function num(v) {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") return Number(v.trim());
    return NaN;
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function fmtTemp(v) {
    var n = num(v);
    if (!isFinite(n)) return DASH;
    return clamp(Math.round(n), -99, 99) + "°C";
}

function pct(v) {
    var n = num(v);
    if (!isFinite(n)) return NaN;
    return clamp(Math.round(n), 0, 100);
}

function fmtPct(v) {
    var n = pct(v);
    return isNaN(n) ? DASH : n + "%";
}

function fmtWind(v) {
    var n = num(v);
    if (!isFinite(n)) return DASH;
    return clamp(Math.round(n), 0, 999) + " km/h";
}

// wttr.in reports the hour as 0, 300, 600 ... 2100.
function hourOf(t) {
    var n = num(t);
    if (!isFinite(n) || n < 0 || n >= 2400) return NaN;
    return Math.floor(n / 100);
}

// No leading zero: the panel right-aligns the column as if every hour had two digits.
function fmtHour(t) {
    var h = hourOf(t);
    return isNaN(h) ? DASH : String(h);
}

// wttr.in gives sunrise and sunset as English 12-hour times ("07:25 AM").
function to24h(s) {
    if (typeof s !== "string") return DASH;
    var m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(s);
    if (!m) return DASH;
    var h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (min > 59) return DASH;
    if (m[3]) {
        if (h < 1 || h > 12) return DASH;
        var pm = m[3].toLowerCase() === "pm";
        h = h % 12 + (pm ? 12 : 0);
    } else if (h > 23) {
        return DASH;
    }
    return (h < 10 ? "0" : "") + h + ":" + m[2];
}

function iconFor(code) {
    return typeof code === "string" && ICONS.hasOwnProperty(code) ? ICONS[code] : "☁️";
}

function dayLabel(i, date) {
    var d = typeof date === "string" ? date : "";
    var lead = i === 0 ? "Today" : (i === 1 ? "Tomorrow" : "");
    if (lead === "") return d;
    return d === "" ? lead : lead + ", " + d;
}

// The location HyDE itself uses: `location = "..."` under [weather] in
// ~/.config/hyde/config.toml. Empty when absent or unusable; wttr.in then
// falls back to a lookup by IP address.
function parseLocation(toml) {
    if (typeof toml !== "string") return "";
    var section = "";
    var lines = toml.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === "" || line.charAt(0) === "#") continue;
        var sec = /^\[([^\]]+)\]\s*(#.*)?$/.exec(line);
        if (sec) { section = sec[1].trim(); continue; }
        if (section !== "weather") continue;
        var m = /^location\s*=\s*(?:"([^"\\]*)"|'([^']*)')\s*(?:#.*)?$/.exec(line);
        if (!m) continue;
        var v = (m[1] !== undefined ? m[1] : m[2]).trim();
        if (v.length < 1 || v.length > 100 || /[\u0000-\u001f\u007f]/.test(v)) return "";
        return v;
    }
    return "";
}

function wttrUrl(location) {
    var loc = typeof location === "string" ? location : "";
    return "https://wttr.in/" + (loc === "" ? "" : encodeURIComponent(loc)) + "?format=j1";
}

function first(list, key) {
    if (!Array.isArray(list) || !isObj(list[0])) return "";
    var v = list[0][key];
    return typeof v === "string" ? v.trim() : "";
}

// Rare events that do not get a column of their own; listed only when above 0.
var EXTRA = [["chanceoffog", "Fog"], ["chanceoffrost", "Frost"], ["chanceofsnow", "Snow"], ["chanceofthunder", "Thunder"]];

function slotOf(h) {
    var extra = [];
    EXTRA.forEach(function (e) {
        var p = pct(h[e[0]]);
        if (p > 0) extra.push(e[1] + " " + p + "%");
    });
    return {
        hour: fmtHour(h.time),
        icon: iconFor(h.weatherCode),
        temp: fmtTemp(h.tempC),
        desc: first(h.weatherDesc, "value"),
        clouds: fmtPct(h.chanceofovercast),
        rain: fmtPct(h.chanceofrain),
        sun: fmtPct(h.chanceofsunshine),
        wind: fmtPct(h.chanceofwindy),
        rainN: pct(h.chanceofrain),
        extra: extra
    };
}

// `nowHour` (0..23) drops today's slots that are more than two hours in the
// past, as HyDE's tooltip does; leave it undefined to keep every slot.
// Never throws: unusable input yields {ok: false, error}.
function parseWttr(d, nowHour) {
    if (!isObj(d) || !Array.isArray(d.current_condition) || !isObj(d.current_condition[0]) || !Array.isArray(d.weather)) {
        return { ok: false, error: "unexpected weather data" };
    }
    var c = d.current_condition[0];
    var area = Array.isArray(d.nearest_area) && isObj(d.nearest_area[0]) ? d.nearest_area[0] : {};
    var city = first(area.areaName, "value"), country = first(area.country, "value");
    var place = city && country ? city + ", " + country : (city || country);
    var now = {
        icon: iconFor(c.weatherCode),
        desc: first(c.weatherDesc, "value"),
        temp: fmtTemp(c.temp_C),
        feels: fmtTemp(c.FeelsLikeC),
        wind: fmtWind(c.windspeedKmph),
        humidity: fmtPct(c.humidity)
    };
    var days = d.weather.slice(0, 3).map(function (day, i) {
        var dd = isObj(day) ? day : {};
        var astro = Array.isArray(dd.astronomy) && isObj(dd.astronomy[0]) ? dd.astronomy[0] : {};
        var slots = (Array.isArray(dd.hourly) ? dd.hourly : []).filter(function (h) {
            if (!isObj(h)) return false;
            if (i !== 0 || typeof nowHour !== "number" || !isFinite(nowHour)) return true;
            var hr = hourOf(h.time);
            return isNaN(hr) || hr >= nowHour - 2;
        }).map(slotOf);
        return {
            label: dayLabel(i, dd.date),
            date: typeof dd.date === "string" ? dd.date : "",
            hi: fmtTemp(dd.maxtempC), lo: fmtTemp(dd.mintempC),
            sunrise: to24h(astro.sunrise), sunset: to24h(astro.sunset),
            slots: slots
        };
    });
    return {
        ok: true, place: place, now: now, days: days,
        face: now.icon + " " + now.temp + (place ? " | " + place : "")
    };
}

// Number of grid columns: hour, icon, temperature, sky, clouds, rain, sun, wind, rare events.
var COLUMNS = 9;

// The model as a flat list of grid cells, so one GridLayout can lay every day
// out in the same columns (rows then line up across days, and a single set of
// column widths covers the widest entry). Cell kinds:
//   head, dayTitle (spans all columns), summary (spans all columns), and per slot
//   hour, icon, temp, desc, pct x4, extra.
function flatten(model) {
    if (!isObj(model) || model.ok !== true || !Array.isArray(model.days) || model.days.length === 0) return [];
    var cells = [];
    ["Hour", "", "Temp", "Sky", "Clouds", "Rain", "Sun", "Wind", ""].forEach(function (t) {
        cells.push({ kind: "head", text: t, span: 1 });
    });
    model.days.forEach(function (day, i) {
        cells.push({ kind: "dayTitle", text: day.label, span: COLUMNS, first: i === 0 });
        cells.push({ kind: "summary", span: COLUMNS, hi: day.hi, lo: day.lo, sunrise: day.sunrise, sunset: day.sunset });
        day.slots.forEach(function (s) {
            cells.push({ kind: "hour", text: s.hour, span: 1 });
            cells.push({ kind: "icon", text: s.icon, span: 1 });
            cells.push({ kind: "temp", text: s.temp, span: 1 });
            cells.push({ kind: "desc", text: s.desc, span: 1 });
            [s.clouds, s.rain, s.sun, s.wind].forEach(function (p) {
                cells.push({ kind: "pct", text: p, span: 1, dim: p === "0%" || p === DASH });
            });
            // no commas: the rare events are separated by spacing only
            cells.push({ kind: "extra", text: s.extra.join("   "), span: 1, dim: true });
        });
    });
    return cells;
}

// Keeps the panel within the space the screen has: later days are thinned to
// every second slot first (6-hour steps), and only then slots are cut from the
// end, last day first. Today's soonest slot always stays. Returns a new model
// and leaves the input untouched; a missing or invalid limit changes nothing.
function fit(model, maxSlots) {
    if (!isObj(model) || model.ok !== true || !Array.isArray(model.days)) return model;
    if (typeof maxSlots !== "number" || !isFinite(maxSlots) || maxSlots < 1) return model;
    var days = model.days.map(function (d) {
        var copy = {};
        Object.keys(d).forEach(function (k) { copy[k] = d[k]; });
        copy.slots = d.slots.slice();
        return copy;
    });
    function total() { return days.reduce(function (n, d) { return n + d.slots.length; }, 0); }
    for (var i = days.length - 1; i >= 1 && total() > maxSlots; i--) {
        if (days[i].slots.length > 4) days[i].slots = days[i].slots.filter(function (_, k) { return k % 2 === 0; });
    }
    for (var j = days.length - 1; j >= 0 && total() > maxSlots; j--) {
        var keep = j === 0 ? 1 : 0;
        var cut = Math.min(total() - maxSlots, days[j].slots.length - keep);
        if (cut > 0) days[j].slots.length = days[j].slots.length - cut;
    }
    var out = {};
    Object.keys(model).forEach(function (k) { out[k] = model[k]; });
    out.days = days;
    return out;
}

if (typeof module !== "undefined") module.exports = {
    fmtTemp: fmtTemp, fmtPct: fmtPct, pct: pct, fmtHour: fmtHour, hourOf: hourOf, to24h: to24h, iconFor: iconFor,
    dayLabel: dayLabel, parseLocation: parseLocation, wttrUrl: wttrUrl, parseWttr: parseWttr,
    flatten: flatten, COLUMNS: COLUMNS, fit: fit
};
