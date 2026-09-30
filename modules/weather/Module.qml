import QtQuick
import qs.core
import qs.components

Item {
    id: root
    required property string moduleId
    required property var screen
    required property var meta

    implicitWidth: sv.implicitWidth
    implicitHeight: sv.implicitHeight

    // A click fetches the weather again (Waybar: pkill -RTMIN+10 waybar).
    readonly property bool pressable: true
    TapHandler { onTapped: sv.refresh() }

    ScriptView {
        id: sv
        moduleId: root.moduleId
        command: root.meta.options.command || []
        interval: root.meta.options.interval || 0
    }
}
