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

    Row {
        anchors { left: parent.left; leftMargin: Theme.spacing; verticalCenter: parent.verticalCenter }
        spacing: Theme.spacing
        Repeater {
            model: win.cfg.left
            delegate: ModuleHost { required property string modelData; moduleId: modelData; screenRef: win.screen }
        }
    }
    Row {
        anchors { horizontalCenter: parent.horizontalCenter; verticalCenter: parent.verticalCenter }
        spacing: Theme.spacing
        Repeater {
            model: win.cfg.center
            delegate: ModuleHost { required property string modelData; moduleId: modelData; screenRef: win.screen }
        }
    }
    Row {
        anchors { right: parent.right; rightMargin: Theme.spacing; verticalCenter: parent.verticalCenter }
        spacing: Theme.spacing
        Repeater {
            model: win.cfg.right
            delegate: ModuleHost { required property string modelData; moduleId: modelData; screenRef: win.screen }
        }
    }
}
