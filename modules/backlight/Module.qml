import QtQuick
import qs.core
import qs.services

Item {
    id: root
    required property string moduleId
    required property var screen
    required property var meta

    visible: Backlight.available
    implicitWidth: visible ? label.implicitWidth : 0
    implicitHeight: label.implicitHeight

    Text {
        id: label
        text: "☀ " + Backlight.percent + "%"
        color: Theme.fg
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }

    MouseArea {
        anchors.fill: parent
        onWheel: wheel => Backlight.set(Backlight.percent + (wheel.angleDelta.y > 0 ? 5 : -5))
    }
}
