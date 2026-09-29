import QtQuick
import qs.core

Item {
    id: root
    required property string moduleId
    required property var screen
    required property var meta
    implicitWidth: label.implicitWidth
    implicitHeight: label.implicitHeight
    Text {
        id: label
        text: "hello " + root.screen.name
        color: Theme.accent
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }
}
