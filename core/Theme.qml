pragma Singleton
import Quickshell
import Quickshell.Io
import QtQuick
import qs.core
import "lib/theme.js" as T

Singleton {
    id: root

    property color bg: T.DEFAULTS.colors.bg
    property color fg: T.DEFAULTS.colors.fg
    property color accent: T.DEFAULTS.colors.accent
    property color muted: T.DEFAULTS.colors.muted
    property color warning: T.DEFAULTS.colors.warning
    property color critical: T.DEFAULTS.colors.critical
    property string fontFamily: T.DEFAULTS.font.family
    property real fontSize: T.DEFAULTS.font.size
    property real radius: T.DEFAULTS.radius
    property real spacing: T.DEFAULTS.spacing

    property var _last: null

    function textOf(view) {
        try { return view.text(); } catch (e) { return ""; }
    }

    function refresh() {
        var r = T.pickTheme([textOf(generated), textOf(shipped)], root._last);
        r.problems.forEach(function (p) { console.warn("[quicy] theme: " + p); });
        var t = r.theme;
        root._last = t;
        bg = t.colors.bg; fg = t.colors.fg; accent = t.colors.accent;
        muted = t.colors.muted; warning = t.colors.warning; critical = t.colors.critical;
        fontFamily = t.font.family; fontSize = t.font.size;
        radius = t.radius; spacing = t.spacing;
    }

    function reload() {
        generated.reload();
        shipped.reload();
    }

    property bool generatedOk: false

    // Written by the HyDE adapter (wallbash); absent when running without HyDE.
    FileView {
        id: generated
        path: Paths.stateDir === "" ? "" : Paths.stateDir + "/theme.json"
        watchChanges: true
        // Verified with Quickshell 0.3.1: the watch survives replace-by-rename
        // writes (tmp file + mv), so no re-arming of watchChanges is needed.
        onFileChanged: reload()
        onLoaded: { root.generatedOk = true; root.refresh(); }
        onLoadFailed: { root.generatedOk = false; root.refresh(); }
    }

    // The file watch cannot be armed on a file whose directory does not exist
    // yet (first wallbash run after installing) and is lost when the file is
    // deleted. Wait for the file with one idle shell instead of polling
    // FileView, which would log a warning on every poll.
    Process {
        running: !root.generatedOk && Paths.stateDir !== ""
        command: ["sh", "-c", 'while [ ! -f "$1" ]; do sleep 2; done', "sh", Paths.stateDir + "/theme.json"]
        onExited: generated.reload()
    }

    FileView {
        id: shipped
        path: Paths.sharedDir + "/themes/example.json"
        onLoaded: root.refresh()
        onLoadFailed: root.refresh()
    }
}
