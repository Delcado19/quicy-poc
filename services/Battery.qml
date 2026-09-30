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
    // Only real charging counts: "fully charged" and "pending charge" (a charge
    // limit holding the battery back) are plugged-in states without a charge.
    readonly property bool charging: available && dev.state === UPowerDeviceState.Charging
    readonly property bool discharging: available && dev.state === UPowerDeviceState.Discharging
    readonly property string kind: B.kindFor(charging, discharging)
    readonly property string state: available ? B.stateFor(percent, charging) : "normal"
}
