import Quickshell
import QtQuick
import qs.core

Item {
    id: root
    required property string moduleId
    required property var screen
    required property var meta

    implicitWidth: label.implicitWidth
    implicitHeight: label.implicitHeight

    SystemClock { id: clock; precision: SystemClock.Minutes }

    Text {
        id: label
        text: Qt.formatDateTime(clock.date, "HH:mm")
        color: Theme.fg
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }
}
