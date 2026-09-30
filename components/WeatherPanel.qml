import QtQuick
import QtQuick.Layouts
import qs.core
import qs.services
import "../core/lib/weather.js" as W

// The weather overview: a small facts block on top, then the three days as one
// table. Columns are real layout columns, not padded text, so everything stays
// aligned whatever the text is. Numeric columns are right-aligned and never
// narrower than the worst case ("00" hours, "-99°C", "100%"); text columns
// grow with their widest entry.
Column {
    id: root

    // Height of the screen the bar is on, in logical pixels; decides how many rows fit.
    property real availableHeight: 1080

    readonly property int size: Theme.fontSize + 1
    readonly property var model: Weather.model
    readonly property string accent: Theme.accent.toString()

    spacing: Theme.spacing * 2

    component Cell: Text {
        font.family: Theme.fontFamily
        font.pixelSize: root.size
        color: Theme.fg
        textFormat: Text.PlainText
    }

    TextMetrics { id: mHour; font.family: Theme.fontFamily; font.pixelSize: root.size; text: "00" }
    TextMetrics { id: mTemp; font.family: Theme.fontFamily; font.pixelSize: root.size; text: "-99°C" }
    TextMetrics { id: mPct; font.family: Theme.fontFamily; font.pixelSize: root.size; text: "100%" }
    // Emoji are not equally wide; the icon column is as wide as the widest of them.
    Repeater {
        id: iconProbe
        model: ["☀️", "⛅", "☁️", "🌧️", "⛈️", "🌨️", "❄️"]
        delegate: Text {
            required property string modelData
            visible: false
            font.family: Theme.fontFamily
            font.pixelSize: root.size
            text: modelData
        }
    }
    readonly property real iconWidth: {
        var w = 0;
        for (var i = 0; i < iconProbe.count; i++) w = Math.max(w, iconProbe.itemAt(i).implicitWidth);
        return w;
    }

    // A popover should not be bigger than it needs to be, and never taller than the screen:
    // the fixed part (facts, header, three day titles and summaries, gaps, the bar) is
    // estimated, the rest is shared out as table rows. Too many rows thin out the later days.
    readonly property real rowHeight: mHour.height + Theme.spacing * 2 / 3
    readonly property int rowBudget: Math.max(4, Math.floor((availableHeight - 12 * rowHeight - 3 * Theme.spacing * 2 - 6 * Theme.spacing - 32 - 24) / rowHeight))
    readonly property var shown: model ? W.fit(model, rowBudget) : null

    // Nothing to show yet, or the first fetch failed.
    Cell {
        visible: root.model === null
        color: Theme.muted
        text: Weather.error !== "" ? "Weather unavailable: " + Weather.error : "Loading weather…"
    }

    // Now
    Cell {
        visible: root.model !== null
        font.bold: true
        text: root.model ? (root.model.now.desc + " " + root.model.now.temp).trim() : ""
    }
    // Facts: labels in one column, values aligned in the next.
    GridLayout {
        visible: root.model !== null
        columns: 2
        columnSpacing: Theme.spacing * 3
        rowSpacing: Theme.spacing / 2
        Repeater {
            model: root.model ? [
                { t: "Feels like", label: true }, { t: root.model.now.feels, label: false },
                { t: "Location", label: true }, { t: root.model.place, label: false },
                { t: "Wind", label: true }, { t: root.model.now.wind, label: false },
                { t: "Humidity", label: true }, { t: root.model.now.humidity, label: false }
            ] : []
            delegate: Cell {
                required property var modelData
                text: modelData.t
                color: modelData.label ? Theme.muted : Theme.fg
            }
        }
    }

    GridLayout {
        id: table
        visible: root.model !== null
        columns: W.COLUMNS
        columnSpacing: Theme.spacing * 3
        rowSpacing: Theme.spacing * 2 / 3

        Repeater {
            model: root.shown ? W.flatten(root.shown) : []
            delegate: Cell {
                id: cell
                required property var modelData
                required property int index

                readonly property string kind: modelData.kind
                readonly property bool alignRight: kind === "hour" || kind === "temp" || kind === "pct"
                    || (kind === "head" && [0, 2, 4, 5, 6, 7].indexOf(index) >= 0)

                Layout.columnSpan: modelData.span
                Layout.alignment: (alignRight ? Qt.AlignRight : Qt.AlignLeft) | Qt.AlignVCenter
                Layout.topMargin: kind === "dayTitle" && !modelData.first ? Theme.spacing * 2 : 0
                Layout.minimumWidth: kind === "hour" ? mHour.advanceWidth
                    : kind === "temp" ? mTemp.advanceWidth
                    : kind === "pct" ? mPct.advanceWidth
                    : kind === "icon" ? root.iconWidth : 0

                // Day summary: high, low, sunrise, sunset in the accent colour, with symbols
                // as well, so nothing depends on colour alone.
                textFormat: kind === "summary" ? Text.StyledText : Text.PlainText
                font.bold: kind === "dayTitle"
                color: kind === "head" || modelData.dim ? Theme.muted : Theme.fg
                text: kind === "summary"
                    ? "<font color='" + root.accent + "'>▲ " + modelData.hi + "</font>   "
                      + "<font color='" + root.accent + "'>▼ " + modelData.lo + "</font>      "
                      + "🌅 <font color='" + root.accent + "'>" + modelData.sunrise + "</font>   "
                      + "🌇 <font color='" + root.accent + "'>" + modelData.sunset + "</font>"
                    : modelData.text
            }
        }
    }

    // Data is kept when a refresh fails; say so instead of pretending it is current.
    Cell {
        visible: root.model !== null && Weather.error !== ""
        color: Theme.muted
        text: "Update failed: " + Weather.error + " (data from " + Weather.updatedAt + ")"
    }
}
