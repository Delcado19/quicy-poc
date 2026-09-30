.pragma library

// Keeps the ids of a bar zone as a list of unique non-empty strings; anything
// else is dropped so a broken layout cannot confuse the model.
function unique(ids) {
    var out = [];
    if (!Array.isArray(ids)) return out;
    ids.forEach(function (id) {
        if (typeof id === "string" && id !== "" && out.indexOf(id) < 0) out.push(id);
    });
    return out;
}

// Plan that turns list `current` into list `next` with as few changes as
// possible, so entries that stay are neither destroyed nor rebuilt (they keep
// their state and only the changed ones animate in or out):
//   {op:"remove", index}   {op:"move", from, to}   {op:"insert", index, id}
// Applied in order, each operation refers to the list as the previous ones left it.
function syncPlan(current, next) {
    var cur = unique(current);
    var want = unique(next);
    var ops = [];
    for (var i = cur.length - 1; i >= 0; i--) {
        if (want.indexOf(cur[i]) < 0) {
            ops.push({ op: "remove", index: i });
            cur.splice(i, 1);
        }
    }
    for (var k = 0; k < want.length; k++) {
        if (cur[k] === want[k]) continue;
        var j = cur.indexOf(want[k]);
        if (j >= 0) {
            ops.push({ op: "move", from: j, to: k });
            cur.splice(k, 0, cur.splice(j, 1)[0]);
        } else {
            ops.push({ op: "insert", index: k, id: want[k] });
            cur.splice(k, 0, want[k]);
        }
    }
    return ops;
}

// Same semantics on a plain array (used by tests; the QML side applies the
// operations to a ListModel).
function applyPlan(list, ops) {
    var out = unique(list);
    ops.forEach(function (o) {
        if (o.op === "remove") out.splice(o.index, 1);
        else if (o.op === "move") out.splice(o.to, 0, out.splice(o.from, 1)[0]);
        else out.splice(o.index, 0, o.id);
    });
    return out;
}

if (typeof module !== "undefined") module.exports = { unique: unique, syncPlan: syncPlan, applyPlan: applyPlan };
