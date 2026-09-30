pragma Singleton
import Quickshell
import Quickshell.Io
import QtQuick
import "../core/lib/weather.js" as W

// Weather for the bar and its panel. Fetches wttr.in once an hour (HyDE's own
// weather script uses the same service and the same `[weather] location` from
// ~/.config/hyde/config.toml) and keeps the last good data if a refresh fails.
Singleton {
    id: root

    property var model: null       // result of W.parseWttr, null until the first success
    property string error: ""      // why the last refresh failed, empty otherwise
    property bool loading: false
    property string updatedAt: ""  // HH:mm of the last successful refresh
    property string location: ""
    property bool configRead: false

    function refresh() {
        if (!configRead || fetcher.running) return;
        loading = true;
        fetcher.command = ["curl", "-sS", "--max-time", "20", W.wttrUrl(location)];
        fetcher.running = true;
    }

    function handle(text) {
        // No output at all means curl failed; onExited reports that.
        if (text.trim() === "") return;
        var data;
        try { data = JSON.parse(text); } catch (e) { error = "the weather service sent an unreadable answer"; return; }
        var m = W.parseWttr(data, new Date().getHours());
        if (!m.ok) { error = m.error; return; }
        model = m;
        error = "";
        updatedAt = Qt.formatTime(new Date(), "HH:mm");
    }

    FileView {
        path: (Quickshell.env("HOME") || "") + "/.config/hyde/config.toml"
        onLoaded: { root.location = W.parseLocation(text()); root.configRead = true; root.refresh(); }
        // No HyDE config: wttr.in then finds the place from the IP address.
        onLoadFailed: { root.location = ""; root.configRead = true; root.refresh(); }
    }

    Process {
        id: fetcher
        stdout: StdioCollector { onStreamFinished: root.handle(text) }
        onExited: (code, status) => {
            root.loading = false;
            if (code !== 0) root.error = "could not reach the weather service (curl " + code + ")";
        }
    }

    Timer {
        interval: 3600000
        running: root.configRead
        repeat: true
        onTriggered: root.refresh()
    }
}
