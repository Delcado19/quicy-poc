pragma Singleton
import Quickshell
import Quickshell.Services.UPower
import QtQuick
import "../core/lib/battery.js" as B

Singleton {
    // UPower's display device already aggregates all batteries (this machine
    // has two), so no per-battery arithmetic is needed here.
    readonly property var dev: UPower.displayDevice
    readonly property bool available: dev !== null && dev !== undefined && dev.isPresent
    readonly property int percent: available ? Math.round(dev.percentage * 100) : 0
    readonly property bool charging: available && (dev.state === UPowerDeviceState.Charging || dev.state === UPowerDeviceState.FullyCharged)
    readonly property string state: available ? B.stateFor(percent, charging) : "normal"
}
