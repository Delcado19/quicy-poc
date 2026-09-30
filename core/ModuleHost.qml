import Quickshell
import Quickshell.Io
import QtQuick
import qs.core
import "lib/modules.js" as M

Item {
    id: host

    required property string moduleId
    required property var screenRef

    // Candidate module dirs, user first. Empty for invalid ids, which are
    // rejected here before any path is read.
    readonly property var dirs: M.candidates(moduleId, Paths.userDir, Paths.sharedDir)
    property int idx: 0
    readonly property bool failed: idx >= dirs.length

    implicitWidth: failed ? placeholder.implicitWidth : (loader.item ? loader.item.implicitWidth : 0)
    implicitHeight: failed ? placeholder.implicitHeight : (loader.item ? loader.item.implicitHeight : 0)
    // A Row lays out by width/height, not implicitWidth/implicitHeight;
    // without these every module would collapse to zero width and overlap.
    width: implicitWidth
    height: implicitHeight
    // A changing text (battery 9% to 10%) would make the neighbours jump; the
    // zone derives their positions from this width, so they glide instead.
    Behavior on width {
        NumberAnimation {
            duration: Theme.reduceMotion ? 0 : Motion.layout
            easing.type: Easing.BezierSpline
            easing.bezierCurve: Motion.standard
        }
    }

    // Optional properties a module can declare on its root item:
    //   interactive: false  no hover fill (a pure read-out with nothing behind it)
    //   pressable: true     a click does something, so pressing gives feedback
    readonly property bool hoverFill: !failed && loader.item !== null && loader.item.interactive !== false
    readonly property bool pressable: !failed && loader.item !== null && loader.item.pressable === true

    // Hover fill, like Waybar's wb-hvr-bg. Quick, because it happens all day.
    Rectangle {
        anchors.fill: parent
        anchors.margins: -Math.round(Theme.spacing / 2)
        radius: Theme.radius
        color: Theme.hover
        opacity: host.hoverFill && hoverHandler.hovered ? 1 : 0
        z: -1
        Behavior on opacity {
            NumberAnimation {
                duration: Theme.reduceMotion ? 0 : (hoverHandler.hovered ? Motion.hoverIn : Motion.hoverOut)
                easing.type: Easing.BezierSpline
                easing.bezierCurve: Motion.standard
            }
        }
    }
    HoverHandler { id: hoverHandler }
    // Passive: only reads the press so the entry can react; the module handles the click itself.
    TapHandler { id: pressHandler; enabled: host.pressable; gesturePolicy: TapHandler.ReleaseWithinBounds }

    Component.onCompleted: {
        if (dirs.length === 0) console.warn("[quicy] module \"" + moduleId + "\": invalid id, rejected");
    }

    // A broken user module falls back to the shipped one; the placeholder only
    // shows when every candidate failed.
    //
    // The index is bumped from the event loop, not inside the FileView signal
    // handler: changing `path` while a (blocking) load is still reporting drops
    // the next load result ("got operation finished from dropped operation"),
    // and the second candidate was then never evaluated.
    function advance(reason) {
        console.warn("[quicy] module " + moduleId + ": " + reason);
        loader.setSource("");
        Qt.callLater(function () { host.idx++; });
    }

    function check(text) {
        var r = M.parseModuleJson(text);
        if (r.meta === null) { advance("module.json: " + r.problems.join("; ")); return; }
        if (!M.apiCompatible(r.meta, Paths.hostApi)) { advance("needs api " + r.meta.api + ", host has " + Paths.hostApi); return; }
        loader.setSource("file://" + dirs[idx] + "/Module.qml", { moduleId: moduleId, screen: screenRef, meta: r.meta });
    }

    FileView {
        id: metaFile
        path: host.failed ? "" : host.dirs[host.idx] + "/module.json"
        blockLoading: true
        onLoaded: host.check(text())
        onLoadFailed: host.advance("no readable module.json in " + host.dirs[host.idx])
    }

    Loader {
        id: loader
        // Press feedback: a small scale-down while the button is held.
        scale: host.pressable && pressHandler.pressed && !Theme.reduceMotion ? Motion.pressScale : 1
        Behavior on scale {
            NumberAnimation {
                duration: pressHandler.pressed ? Motion.pressDown : Motion.pressUp
                easing.type: Easing.BezierSpline
                easing.bezierCurve: Motion.standard
            }
        }
        onLoaded: console.info("[quicy] module " + host.moduleId + ": loaded from " + host.dirs[host.idx])
        onStatusChanged: if (status === Loader.Error) host.advance("failed to load Module.qml from " + host.dirs[host.idx])
    }

    Text {
        id: placeholder
        visible: host.failed
        text: "⚠ " + host.moduleId
        color: Theme.critical
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }
}
