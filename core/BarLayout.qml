pragma Singleton
import Quickshell
import Quickshell.Io
import QtQuick
import qs.core
import "lib/layout.js" as L

Singleton {
    id: root

    property var merged: L.mergeLayout(L.parseLayout("").layout, L.parseLayout("").layout)
    property var state: ({ extra: [], hidden: [] })
    // Bars bind to this so they re-evaluate forScreen() after any change.
    property int revision: 0

    function textOf(view) {
        try { return view.text(); } catch (e) { return ""; }
    }

    property bool shippedDone: false
    property bool userDone: false
    property bool userOk: false
    property string _signature: ""

    function refresh() {
        // Wait for both files: a first merge with only one of them would make
        // every bar build its modules twice (and run their scripts twice).
        if (!shippedDone || !(userDone || Paths.userDir === "")) return;
        var s = L.parseLayout(textOf(shipped));
        var u = L.parseLayout(textOf(user));
        s.problems.forEach(function (p) { console.warn("[quicy] shipped layout: " + p); });
        u.problems.forEach(function (p) { console.warn("[quicy] user layout: " + p); });
        var m = L.mergeLayout(s.layout, u.layout);
        var sig = JSON.stringify(m);
        state = { extra: [], hidden: [] }; // reload discards IPC-loaded/hidden ids
        // An unchanged layout must not bump the revision: that rebuilds every
        // module of every bar.
        if (sig === _signature && revision > 0) return;
        _signature = sig;
        merged = m;
        revision++;
    }

    function forScreen(name) {
        var b = L.forScreen(merged, name, state.extra, state.hidden);
        b.problems.forEach(function (p) { console.warn("[quicy] layout (" + name + "): " + p); });
        return b;
    }

    function reload() {
        shipped.reload();
        user.reload();
    }

    function load(id) {
        var r = L.loadId(state, id, L.commonIds(merged).indexOf(id) >= 0);
        if (r.changed) { state = r.state; revision++; }
        return r.changed;
    }

    function unload(id) {
        var r = L.unloadId(state, id, L.allIds(merged).indexOf(id) >= 0);
        if (r.changed) { state = r.state; revision++; }
        return r.changed;
    }

    FileView {
        id: shipped
        path: Paths.sharedDir + "/layouts/default.json"
        watchChanges: true
        onFileChanged: root.reload()
        onLoaded: { root.shippedDone = true; root.refresh(); }
        onLoadFailed: { root.shippedDone = true; root.refresh(); }
    }

    FileView {
        id: user
        path: Paths.userDir === "" ? "" : Paths.userDir + "/layout.json"
        watchChanges: true
        onFileChanged: root.reload()
        onLoaded: { root.userOk = true; root.userDone = true; root.refresh(); }
        onLoadFailed: { root.userOk = false; root.userDone = true; root.refresh(); }
    }

    // First use: neither ~/.config/quicy nor layout.json exists yet, and the
    // watch above cannot be armed on a missing file.
    FileWaiter {
        path: Paths.userDir === "" ? "" : Paths.userDir + "/layout.json"
        wanted: !root.userOk
        onAppeared: user.reload()
    }
}
