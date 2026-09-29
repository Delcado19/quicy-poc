import Quickshell.Io
import QtQuick

// Emits appeared() once `path` exists. A FileView cannot watch a file whose
// directory does not exist yet, and loses the watch when the file is deleted;
// one idle shell waits instead of polling FileView, which would log a warning
// on every poll. The loop also ends when quickshell is gone: children are not
// reaped when the shell is killed, and an unguarded loop would run forever.
Process {
    id: root

    property string path: ""
    // Wait only while the caller does not have the file loaded.
    property bool wanted: false
    signal appeared()

    running: wanted && path !== ""
    command: ["sh", "-c", 'p=$PPID; while [ ! -f "$1" ] && kill -0 $p 2>/dev/null; do sleep 2; done', "sh", path]
    onExited: appeared()
}
