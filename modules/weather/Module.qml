import QtQuick
import qs.core
import qs.components
import qs.services

Item {
    id: root
    required property string moduleId
    required property var screen
    required property var meta

    implicitWidth: label.implicitWidth
    implicitHeight: label.implicitHeight
    width: implicitWidth
    height: implicitHeight

    // A click fetches the weather again (Waybar: pkill -RTMIN+10 waybar).
    readonly property bool pressable: true
    TapHandler { onTapped: Weather.refresh() }

    Text {
        id: label
        text: (Weather.error !== "" ? "! " : "")
            + (Weather.model ? Weather.model.face : (Weather.error !== "" ? "Weather --" : "…"))
        opacity: Weather.error !== "" ? 0.6 : 1
        color: Theme.fg
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }

    Popover {
        target: root
        WeatherPanel { availableHeight: root.screen ? root.screen.height : 1080 }
    }
}
