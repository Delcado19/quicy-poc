import Quickshell.Io
import QtQuick
import qs.core
import "../core/lib/script.js" as S

Item {
    id: root

    required property string moduleId
    property var command: []
    property int interval: 0     // ms between runs; 0 = long-running stream
    property int timeout: 10000  // ms, kills a hung periodic run
    property var value: ({ text: "", alt: "", tooltip: "", classes: [] })
    property string error: ""
    property int backoff: 1000
    // Set by refresh() so the resulting exit restarts immediately instead of
    // counting as a crash (which would grow the backoff).
    property bool manualRestart: false

    implicitWidth: label.implicitWidth
    implicitHeight: label.implicitHeight

    function refresh() {
        if (command.length === 0) return;
        if (interval === 0) {
            if (proc.running) { manualRestart = true; proc.running = false; }
            else { restart.interval = 1; restart.restart(); }
        } else if (!proc.running) proc.running = true;
    }

    // Periodic runs go through coreutils `timeout`, which kills the whole
    // process group. Stopping the Process alone only signals the direct child,
    // so a hung wrapper script would leave its children (curl, sleep, ...)
    // running and pile up one orphan per interval.
    readonly property var effectiveCommand: interval > 0 && command.length > 0
        ? ["timeout", "-k", "2", String(Math.max(1, Math.ceil(timeout / 1000)))].concat(command)
        : command

    Process {
        id: proc
        command: root.effectiveCommand
        running: root.command.length > 0 && root.interval === 0
        stdout: SplitParser {
            onRead: line => {
                var r = S.parseScriptLine(line, root.value);
                root.value = r.value;
                root.error = r.error === null ? "" : r.error;
                if (r.error === null) root.backoff = 1000;
                else console.warn("[quicy] " + root.moduleId + ": " + r.error);
            }
        }
        onStarted: if (root.interval > 0) killer.restart()
        onExited: (code, status) => {
            killer.stop();
            if (root.interval === 0 && root.command.length > 0) {
                if (root.manualRestart) {
                    root.manualRestart = false;
                    restart.interval = 1;
                } else {
                    // A stream that dies is restarted with growing delay so a
                    // script that exits immediately cannot spin the CPU.
                    restart.interval = root.backoff;
                    root.backoff = S.nextBackoff(root.backoff);
                }
                restart.restart();
            }
        }
    }

    Timer {
        interval: root.interval
        running: root.interval > 0 && root.command.length > 0
        repeat: true
        triggeredOnStart: true
        onTriggered: if (!proc.running) proc.running = true
    }

    // Backstop only; `timeout` normally ends the run first.
    Timer { id: killer; interval: root.timeout + 5000; onTriggered: proc.running = false }
    Timer { id: restart; onTriggered: proc.running = true }

    Connections {
        target: Ipc
        function onRefreshRequested(id) { if (id === root.moduleId) root.refresh(); }
    }

    Text {
        id: label
        text: (root.error !== "" ? "! " : "") + root.value.text
        opacity: root.error !== "" ? 0.6 : 1
        color: root.value.classes.indexOf("critical") >= 0 ? Theme.critical
             : root.value.classes.indexOf("warning") >= 0 ? Theme.warning : Theme.fg
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSize
    }
}
