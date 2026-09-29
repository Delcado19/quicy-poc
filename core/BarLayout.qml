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

    function refresh() {
        var s = L.parseLayout(textOf(shipped));
        var u = L.parseLayout(textOf(user));
        s.problems.forEach(function (p) { console.warn("[quicy] shipped layout: " + p); });
        u.problems.forEach(function (p) { console.warn("[quicy] user layout: " + p); });
        merged = L.mergeLayout(s.layout, u.layout);
        state = { extra: [], hidden: [] }; // reload discards IPC-loaded/hidden ids
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
        var r = L.loadId(state, id, L.allIds(merged).indexOf(id) >= 0);
        if (r.changed) { state = r.state; revision++; }
        return r.changed;
    }

    function unload(id) {
        var r = L.unloadId(state, id);
        if (r.changed) { state = r.state; revision++; }
        return r.changed;
    }

    FileView {
        id: shipped
        path: Paths.sharedDir + "/layouts/default.json"
        watchChanges: true
        onFileChanged: root.reload()
        onLoaded: root.refresh()
        onLoadFailed: root.refresh()
    }

    FileView {
        id: user
        path: Paths.userDir === "" ? "" : Paths.userDir + "/layout.json"
        watchChanges: true
        onFileChanged: root.reload()
        onLoaded: root.refresh()
        onLoadFailed: root.refresh()
    }
}
