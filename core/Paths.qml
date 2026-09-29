pragma Singleton
import Quickshell
import QtQuick
import "lib/modules.js" as M

Singleton {
    // Bumped only on breaking changes to the service singletons; modules
    // declare the version they were written against in module.json.
    readonly property int hostApi: 1
    readonly property string sharedDir: Quickshell.shellDir
    readonly property string userDir: M.userDir(function (k) { return Quickshell.env(k); })
    readonly property string stateDir: M.stateDir(function (k) { return Quickshell.env(k); })
}
