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
    property bool gotOutput: false   // the current run printed anything at all
    property double startedAt: 0

    // 0 = stream; anything else is floored at one second.
    readonly property int poll: S.clampInterval(interval)

    // Every run goes through coreutils `timeout`, which puts the command in its
    // own process group and kills the whole group on expiry or on SIGTERM.
    // Stopping the Process alone only signals the direct child, so a hung
    // wrapper script or a pipeline (playerctl -F | jq) would leave its
    // children running and pile up. Periodic runs get the real timeout;
    // streams use duration 0, i.e. no timeout, for the group kill alone.
    readonly property var effectiveCommand: command.length === 0 ? command
        : ["timeout", "-k", "2", poll > 0 ? String(Math.max(1, Math.ceil(timeout / 1000))) : "0"].concat(command)

    implicitWidth: label.implicitWidth
    implicitHeight: label.implicitHeight

    function refresh() {
        if (command.length === 0) return;
        if (poll === 0) {
            if (proc.running) { manualRestart = true; proc.running = false; }
            else { restart.interval = 1; restart.restart(); }
        } else if (!proc.running) proc.running = true;
    }

    Process {
        id: proc
        command: root.effectiveCommand
        running: root.command.length > 0 && root.poll === 0
        stdout: SplitParser {
            onRead: line => {
                var r = S.parseScriptLine(line, root.value);
                root.value = r.value;
                var msg = r.error === null ? "" : r.error;
                // Log only when the problem changes: a script that prints plain
                // text every second would otherwise flood the log.
                if (msg !== "" && msg !== root.error) console.warn("[quicy] " + root.moduleId + ": " + msg);
                root.error = msg;
                root.gotOutput = true;
            }
        }
        onStarted: {
            root.startedAt = Date.now();
            root.gotOutput = false;
            if (root.poll > 0) killer.restart();
        }
        onExited: (code, status) => {
            killer.stop();
            // A run that printed nothing must not leave old data looking
            // current (no network, script crashed, timed out). A run that
            // printed garbage already set its own, more specific error.
            var note = S.exitNote(root.gotOutput, code);
            if (note !== "") {
                if (note !== root.error) console.warn("[quicy] " + root.moduleId + ": " + note);
                root.error = note;
            }
            if (root.poll === 0 && root.command.length > 0) {
                if (root.manualRestart) {
                    root.manualRestart = false;
                    restart.interval = 1;
                } else {
                    // A stream that dies is restarted with growing delay so a
                    // script that exits immediately cannot spin the CPU. Only a
                    // run that lasted a while resets the delay.
                    var plan = S.restartPlan(root.backoff, Date.now() - root.startedAt);
                    restart.interval = plan.delay;
                    root.backoff = plan.next;
                }
                restart.restart();
            }
        }
    }

    Timer {
        interval: root.poll
        running: root.poll > 0 && root.command.length > 0
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
