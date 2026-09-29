import Quickshell
import QtQuick
import qs.core
// Modules are loaded dynamically, so Quickshell only registers the "qs.services"
// import path if a statically loaded file imports it. Modules rely on it.
import qs.services

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
