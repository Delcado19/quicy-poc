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
