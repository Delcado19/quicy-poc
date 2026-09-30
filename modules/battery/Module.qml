import QtQuick
import qs.core
import qs.services
import "../../core/lib/battery.js" as B

Item {
    id: root
    required property string moduleId
    required property var screen
    required property var meta

    // Desktop machines have no battery: the module takes no space at all.
    visible: Battery.available
    implicitWidth: visible ? label.implicitWidth : 0
    implicitHeight: label.implicitHeight

    Text {
        id: label
        text: B.label(Battery.kind, Battery.percent, root.meta.options.symbols)
        color: Battery.state === "critical" ? Theme.critical : Battery.state === "warning" ? Theme.warning : Theme.fg
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }
}
