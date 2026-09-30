import QtQuick
import qs.core
import "lib/zone.js" as Z

// One zone of the bar (left, centre, right): a row of module entries. Entries
// that stay are kept as they are, new ones grow in and fade in, removed ones
// shrink and fade out, so changing the layout never rebuilds the whole bar.
//
// Every cell animates its own width and the zone is just the sum of its cells,
// so the geometry is consistent on every frame (an edge-anchored zone whose
// width and cells are animated separately wobbles). A removed entry therefore
// stays in the model, marked `leaving`, until it has shrunk to nothing.
ListView {
    id: zone

    property var ids: []
    required property var screenRef

    // Ids that should be visible now (leaving entries are not part of it).
    property var shown: []

    orientation: ListView.Horizontal
    interactive: false
    spacing: 0
    width: contentWidth

    model: ListModel { id: items }

    // Position in the model of the n-th entry that is not leaving.
    function modelIndex(n) {
        var seen = -1;
        for (var i = 0; i < items.count; i++) {
            if (!items.get(i).leaving && ++seen === n) return i;
        }
        return items.count;
    }

    function dropLeaving(id) {
        for (var i = items.count - 1; i >= 0; i--) {
            if (items.get(i).leaving && items.get(i).mid === id) items.remove(i);
        }
    }

    function sync() {
        var ops = Z.syncPlan(shown, ids);
        ops.forEach(function (o) {
            if (o.op === "remove") {
                items.setProperty(modelIndex(o.index), "leaving", true);
                sweep.restart();
            } else if (o.op === "move") {
                // Reordering is rare; the entry is rebuilt at its new place.
                var from = modelIndex(o.from);
                var id = items.get(from).mid;
                items.remove(from);
                items.insert(modelIndex(o.to), { mid: id, leaving: false });
            } else {
                // Coming back while still shrinking: drop the old copy so the
                // module is not instantiated twice.
                dropLeaving(o.id);
                items.insert(modelIndex(o.index), { mid: o.id, leaving: false });
            }
        });
        shown = Z.unique(ids);
    }
    onIdsChanged: sync()
    Component.onCompleted: sync()

    Timer {
        id: sweep
        interval: Motion.exit + 60
        onTriggered: {
            for (var i = items.count - 1; i >= 0; i--) {
                if (items.get(i).leaving) items.remove(i);
            }
        }
    }

    // A cell is the entry plus half the gap on each side, so the gap grows and
    // shrinks together with the entry.
    delegate: Item {
        id: cell
        required property string mid
        required property bool leaving

        // 0 = gone, 1 = fully there.
        property real grow: 0
        Behavior on grow {
            NumberAnimation {
                duration: Theme.reduceMotion ? 0 : (cell.leaving ? Motion.exit : Motion.enter)
                easing.type: Easing.BezierSpline
                easing.bezierCurve: Motion.standard
            }
        }
        Component.onCompleted: grow = 1
        onLeavingChanged: if (leaving) grow = 0

        width: (host.width + Theme.spacing) * grow
        height: zone.height
        opacity: grow
        clip: true

        ModuleHost {
            id: host
            x: Theme.spacing / 2
            anchors.verticalCenter: parent.verticalCenter
            moduleId: cell.mid
            screenRef: zone.screenRef
        }
    }
}
