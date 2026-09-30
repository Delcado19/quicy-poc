import Quickshell
import QtQuick
import qs.core

// A panel that comes out of a bar entry: it opens above (or below, if there is
// no room) the `target` entry, grows and fades in, and closes the same way. It
// only knows how to appear; what it shows is whatever is placed inside it:
//
//     Popover { target: root; Text { text: "..." } }
//
// By default it opens when the pointer rests on the target for `delay` ms and
// closes when it leaves (a read-only peek). Set `hoverTrigger: false` and drive
// `open` yourself for panels that are opened by other means, for example a click.
Item {
    id: pop

    required property Item target
    property bool enabled: true
    property bool hoverTrigger: true
    property int delay: 250
    // Requested state. Written by the hover logic while `hoverTrigger` is on.
    property bool open: false
    // True while the panel is visible, including the closing animation.
    readonly property bool active: win.visible

    default property alias content: body.data

    // 0 = hidden, 1 = fully there. The slide (spatial) is slow, the fade (effects)
    // fast, so the content is readable while the panel is still settling. A
    // Behavior retargets from the current value, so moving the pointer in and out
    // quickly reverses the motion instead of restarting it. Closing is quicker.
    readonly property bool shown: enabled && open
    property real slide: shown ? 1 : 0
    Behavior on slide {
        NumberAnimation {
            duration: Theme.reduceMotion ? 0 : (pop.shown ? Motion.spatialIn : Motion.spatialOut)
            easing.type: Easing.BezierSpline
            easing.bezierCurve: pop.shown ? Motion.emphasizedDecel : Motion.standard
        }
    }
    property real fade: shown ? 1 : 0
    Behavior on fade {
        NumberAnimation {
            duration: Theme.reduceMotion ? Motion.reduced : (pop.shown ? Motion.effectsIn : Motion.effectsOut)
            easing.type: Easing.BezierSpline
            easing.bezierCurve: Motion.effects
        }
    }

    HoverHandler {
        id: hover
        parent: pop.target
        enabled: pop.hoverTrigger
        onHoveredChanged: if (!hovered) pop.open = false
    }
    Timer {
        interval: pop.delay
        running: pop.hoverTrigger && pop.enabled && hover.hovered && !pop.open
        onTriggered: pop.open = true
    }

    PopupWindow {
        id: win
        // Stays mapped while the closing animation runs.
        visible: pop.enabled && (pop.open || pop.slide > 0.001 || pop.fade > 0.001)
        anchor.item: pop.target
        anchor.rect.x: 0
        anchor.rect.y: 0
        anchor.rect.width: pop.target.width
        anchor.rect.height: pop.target.height
        // Open away from the bar edge; Flip turns it around if there is no room.
        anchor.edges: Edges.Top
        anchor.gravity: Edges.Top
        anchor.adjustment: PopupAdjustment.Flip | PopupAdjustment.Slide
        implicitWidth: box.width
        implicitHeight: box.height
        color: "transparent"

        Rectangle {
            id: box
            opacity: pop.fade
            // Grows from the bar edge as well as sliding up (no overshoot: the popup
            // window would clip it). The window clips to its own area, whose bottom
            // edge sits at the bar, so sliding up reads as coming out of the bar.
            scale: Theme.reduceMotion ? 1 : Motion.popupScale + (1 - Motion.popupScale) * pop.slide
            transformOrigin: Item.Bottom
            y: Theme.reduceMotion ? 0 : (1 - pop.slide) * Math.min(height, 200)
            width: body.childrenRect.width + 4 * Theme.spacing
            height: body.childrenRect.height + 4 * Theme.spacing
            radius: Theme.radius
            // Near-opaque: the bar's own background lets the wallpaper shine through.
            color: Qt.rgba(Theme.bg.r, Theme.bg.g, Theme.bg.b, 0.96)
            border.width: 1
            border.color: Qt.rgba(Theme.fg.r, Theme.fg.g, Theme.fg.b, 0.25)

            Item {
                id: body
                x: 2 * Theme.spacing
                y: 2 * Theme.spacing
            }
        }
    }
}
