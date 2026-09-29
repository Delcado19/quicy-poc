import Quickshell
import QtQuick
import qs.core

PanelWindow {
    id: win

    anchors {
        left: true
        right: true
        bottom: true
    }
    implicitHeight: Math.round(Theme.fontSize * 2 + Theme.spacing * 2)
    color: Theme.bg

    Text {
        anchors.centerIn: parent
        color: Theme.fg
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
        text: (win.screen ? win.screen.name : "?") + "  shared=" + Paths.sharedDir + "  user=" + Paths.userDir
    }
}
