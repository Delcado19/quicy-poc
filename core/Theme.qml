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
    property color hover: T.DEFAULTS.colors.hover
    property string fontFamily: T.DEFAULTS.font.family
    property real fontSize: T.DEFAULTS.font.size
    property real radius: T.DEFAULTS.radius
    property real spacing: T.DEFAULTS.spacing
    property bool reduceMotion: T.DEFAULTS.reduceMotion

    property var _last: null
    // Colours fade only once the first real theme is in; the start-up values
    // themselves must not fade in from the built-in defaults.
    property bool ready: false
    property bool generatedDone: false

    component Fade: ColorAnimation {
        duration: root.reduceMotion ? 0 : Motion.colorFade
        easing.type: Easing.BezierSpline
        easing.bezierCurve: Motion.standard
    }
    // A wallpaper or theme change cross-fades the whole bar instead of jumping.
    Behavior on bg { enabled: root.ready; Fade {} }
    Behavior on fg { enabled: root.ready; Fade {} }
    Behavior on accent { enabled: root.ready; Fade {} }
    Behavior on muted { enabled: root.ready; Fade {} }
    Behavior on warning { enabled: root.ready; Fade {} }
    Behavior on critical { enabled: root.ready; Fade {} }
    Behavior on hover { enabled: root.ready; Fade {} }

    function textOf(view) {
        try { return view.text(); } catch (e) { return ""; }
    }

    property bool shippedDone: false

    function refresh() {
        // The shipped theme is the last fallback; deciding before it has been
        // read would log a misleading "no usable theme" during startup.
        if (!shippedDone || !(generatedDone || Paths.stateDir === "")) return;
        var r = T.pickTheme([textOf(generated), textOf(shipped)], root._last);
        r.problems.forEach(function (p) { console.warn("[quicy] theme: " + p); });
        var t = r.theme;
        root._last = t;
        bg = t.colors.bg; fg = t.colors.fg; accent = t.colors.accent;
        muted = t.colors.muted; warning = t.colors.warning; critical = t.colors.critical; hover = t.colors.hover;
        fontFamily = t.font.family; fontSize = t.font.size;
        radius = t.radius; spacing = t.spacing; reduceMotion = t.reduceMotion;
        ready = true;
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
        onLoaded: { root.generatedOk = true; root.generatedDone = true; root.refresh(); }
        onLoadFailed: { root.generatedOk = false; root.generatedDone = true; root.refresh(); }
    }

    FileWaiter {
        path: Paths.stateDir === "" ? "" : Paths.stateDir + "/theme.json"
        wanted: !root.generatedOk
        onAppeared: generated.reload()
    }

    FileView {
        id: shipped
        path: Paths.sharedDir + "/themes/example.json"
        onLoaded: { root.shippedDone = true; root.refresh(); }
        onLoadFailed: { root.shippedDone = true; root.refresh(); }
    }
}
