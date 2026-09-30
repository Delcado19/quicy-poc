pragma Singleton
import Quickshell
import QtQuick

// Motion tokens for panels that come out of the bar. The values follow the
// Material 3 easing tokens that the Quickshell shells Caelestia and
// DankMaterialShell use for their bar popouts: a slow spatial move (well under
// a second) with a much faster fade next to it. Keeping them here means every
// popup moves the same way and the feel is tuned in one place.
Singleton {
    // Spatial movement (slide). Opening decelerates gently, closing is quicker.
    readonly property int spatialIn: 1000
    readonly property int spatialOut: 650
    // Effects (fade) run faster than the movement so the panel is readable early.
    readonly property int effectsIn: 420
    readonly property int effectsOut: 350
    // Used instead of the slide when Theme.reduceMotion is set.
    readonly property int reduced: 150

    // Short interface feedback: things that happen tens of times a day stay quick.
    readonly property int hoverIn: 120
    readonly property int hoverOut: 160
    readonly property int pressDown: 100
    readonly property int pressUp: 160
    readonly property real pressScale: 0.97
    // Occasional state changes.
    readonly property int colorFade: 300     // theme / wallpaper change
    readonly property int layout: 200        // width of an entry, neighbours sliding
    readonly property int enter: 200         // module appears
    readonly property int exit: 150          // module disappears
    readonly property real popupScale: 0.96  // popup grows from this size

    // Cubic-bezier control points as Qt wants them: x1, y1, x2, y2, 1, 1.
    readonly property var emphasizedDecel: [0.05, 0.7, 0.1, 1, 1, 1]  // enter
    readonly property var standard: [0.2, 0, 0, 1, 1, 1]              // exit
    readonly property var effects: [0.34, 0.8, 0.34, 1, 1, 1]         // fade
}
