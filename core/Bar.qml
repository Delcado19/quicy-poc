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
    implicitHeight: 28
    color: "#1e1e2e"

    Text {
        anchors.centerIn: parent
        color: "#cdd6f4"
        text: (win.screen ? win.screen.name : "?") + "  shared=" + Paths.sharedDir + "  user=" + Paths.userDir
    }
}
