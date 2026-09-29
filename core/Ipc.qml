pragma Singleton
import Quickshell
import Quickshell.Io
import QtQuick
import qs.core
import "lib/modules.js" as M

Singleton {
    id: root
    signal refreshRequested(string id)

    IpcHandler {
        target: "module"

        function load(id: string): string {
            if (!M.isValidId(id)) return "invalid module id";
            return BarLayout.load(id) ? "loaded " + id : "no change";
        }
        function unload(id: string): string {
            if (!M.isValidId(id)) return "invalid module id";
            return BarLayout.unload(id) ? "unloaded " + id : "no change";
        }
        function refresh(id: string): string {
            if (!M.isValidId(id)) return "invalid module id";
            root.refreshRequested(id);
            return "refresh requested for " + id;
        }
    }

    IpcHandler {
        target: "theme"
        function reload(): string { Theme.reload(); return "theme reloaded"; }
    }

    IpcHandler {
        target: "layout"
        function reload(): string { BarLayout.reload(); return "layout reloaded"; }
    }
}
