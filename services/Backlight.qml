pragma Singleton
import Quickshell
import Quickshell.Io
import QtQuick
import "../core/lib/backlight.js" as K

Singleton {
    id: root

    property int percent: -1
    readonly property bool available: percent >= 0
    // Polls that ended without a valid reading. After 3 the poll stops: with
    // brightnessctl missing every poll would otherwise log a start-failure
    // warning forever. Counted in the timer because a process that fails to
    // start never emits exited().
    property int failures: 0

    function set(p) {
        var v = K.clampPercent(p);
        if (v === null) return;
        setProc.command = ["brightnessctl", "set", v + "%"];
        setProc.running = true;
    }

    Process {
        id: readProc
        command: ["brightnessctl", "-m"]
        running: true
        stdout: SplitParser {
            onRead: line => {
                var p = K.parseBrightnessctl(line);
                root.percent = p === null ? -1 : p;
                if (p !== null) root.failures = 0;
            }
        }
        // brightnessctl missing or no backlight device: hide the module.
        onExited: (code, status) => { if (code !== 0) root.percent = -1; }
    }

    Timer {
        interval: 2000
        running: root.failures < 3
        repeat: true
        onTriggered: {
            if (readProc.running) return;
            if (root.percent < 0) root.failures++;
            readProc.running = true;
        }
    }

    Process {
        id: setProc
        onExited: if (!readProc.running) readProc.running = true
    }
}
