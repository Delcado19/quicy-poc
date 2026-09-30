import Quickshell
import QtQuick
import qs.core

PanelWindow {
    id: win

    // Singletons are created on first reference; Ipc has no other user, so it
    // is referenced here to make sure its IpcHandlers exist.
    readonly property var keepAlive: [Ipc, Theme]

    // Reading `revision` makes this re-evaluate after layout/IPC changes.
    readonly property var cfg: { BarLayout.revision; return BarLayout.forScreen(win.screen ? win.screen.name : ""); }

    anchors {
        left: true
        right: true
        top: cfg.edge === "top"
        bottom: cfg.edge !== "top"
    }
    implicitHeight: Math.round(Theme.fontSize * 2 + Theme.spacing * 2)
    color: Theme.bg

    Zone {
        ids: win.cfg.left
        screenRef: win.screen
        height: parent.height
        anchors { left: parent.left; leftMargin: Theme.spacing / 2 }
    }
    Zone {
        ids: win.cfg.center
        screenRef: win.screen
        height: parent.height
        anchors.horizontalCenter: parent.horizontalCenter
    }
    Zone {
        ids: win.cfg.right
        screenRef: win.screen
        height: parent.height
        anchors { right: parent.right; rightMargin: Theme.spacing / 2 }
    }
}
