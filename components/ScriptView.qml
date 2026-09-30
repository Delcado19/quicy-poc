import Quickshell
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
    // An Item does not size itself to its implicit size. Without a real area the
    // hover handler never fires and the popup anchor rectangle is empty.
    width: implicitWidth
    height: implicitHeight

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

    // Hover tooltip: the script's "tooltip" field, shown in a popup next to the
    // entry (Waybar shows the same field). Shown after a short delay so sweeping
    // the pointer across the bar does not flash popups.
    readonly property string tooltipText: S.tooltipMarkup(value.tooltip)
    property bool showTip: false

    // The popup slides up out of the bar edge and fades in. The slide is slow
    // (Motion.spatialIn) and the fade fast, as in the reference shells, so the
    // text is readable while the panel is still settling. A Behavior retargets
    // from the current value, so moving the pointer in and out quickly reverses
    // the motion instead of restarting it. Closing is quicker, same path.
    property real slide: showTip ? 1 : 0
    Behavior on slide {
        NumberAnimation {
            duration: Theme.reduceMotion ? 0 : (root.showTip ? Motion.spatialIn : Motion.spatialOut)
            easing.type: Easing.BezierSpline
            easing.bezierCurve: root.showTip ? Motion.emphasizedDecel : Motion.standard
        }
    }
    property real fade: showTip ? 1 : 0
    Behavior on fade {
        NumberAnimation {
            duration: Theme.reduceMotion ? Motion.reduced : (root.showTip ? Motion.effectsIn : Motion.effectsOut)
            easing.type: Easing.BezierSpline
            easing.bezierCurve: Motion.effects
        }
    }

    HoverHandler {
        id: hover
        onHoveredChanged: if (!hovered) root.showTip = false
    }

    Timer {
        interval: 250
        running: hover.hovered && root.tooltipText !== "" && !root.showTip
        onTriggered: root.showTip = true
    }

    PopupWindow {
        // Stays mapped while the closing animation runs.
        visible: root.tooltipText !== "" && (root.showTip || root.slide > 0.001 || root.fade > 0.001)
        anchor.item: root
        anchor.rect.x: 0
        anchor.rect.y: 0
        anchor.rect.width: root.width
        anchor.rect.height: root.height
        // Open away from the bar edge; Flip turns it around if there is no room.
        anchor.edges: Edges.Top
        anchor.gravity: Edges.Top
        anchor.adjustment: PopupAdjustment.Flip | PopupAdjustment.Slide
        implicitWidth: tipBox.width
        implicitHeight: tipBox.height
        color: "transparent"

        Rectangle {
            id: tipBox
            opacity: root.fade
            // Grows from the bar edge as well as sliding up (no overshoot: the popup
            // window would clip it).
            scale: Theme.reduceMotion ? 1 : Motion.popupScale + (1 - Motion.popupScale) * root.slide
            transformOrigin: Item.Bottom
            // The popup window clips to its own area, whose bottom edge sits at
            // the bar: sliding up from below reads as coming out of the bar.
            // Reduced motion only fades.
            y: Theme.reduceMotion ? 0 : (1 - root.slide) * Math.min(height, 200)
            width: Math.min(560, measure.implicitWidth) + 2 * Theme.spacing * 2
            height: tip.implicitHeight + 2 * Theme.spacing * 2
            radius: Theme.radius
            // Near-opaque: the bar's own background lets the wallpaper shine through.
            color: Qt.rgba(Theme.bg.r, Theme.bg.g, Theme.bg.b, 0.96)
            border.width: 1
            border.color: Qt.rgba(Theme.fg.r, Theme.fg.g, Theme.fg.b, 0.25)

            // Same text without wrapping, only to learn its natural width.
            Text {
                id: measure
                visible: false
                text: root.tooltipText
                textFormat: Text.StyledText
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSize
            }

            Text {
                id: tip
                x: Theme.spacing * 2
                y: Theme.spacing * 2
                width: parent.width - 4 * Theme.spacing
                text: root.tooltipText
                textFormat: Text.StyledText
                wrapMode: Text.Wrap
                color: Theme.fg
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSize
            }
        }
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
