import Quickshell
import QtQuick
import qs.core

ShellRoot {
    // One bar per monitor; Variants also creates/removes bars on hotplug.
    Variants {
        model: Quickshell.screens
        delegate: Bar {
            required property var modelData
            screen: modelData
        }
    }
}
