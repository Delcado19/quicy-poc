# QuiCy PoC – Design

Status: draft, awaiting review (2026-09-29)
Context: HyDE Discussion #2038 (Quickshell infrastructure). Background notes: `~/quickshell-poc/notes/`.

## Purpose

A minimal proof of concept that answers, early and cheaply, whether a modular Quickshell
bar can reach Waybar parity in HyDE. It is candidate content for kRHYME7's QuiCy repo, not a
competing product. Folder and file names follow the conventions described in the discussion
(`core/Theme.qml`, one folder per module, IPC-driven, single Quickshell process) and are to be
aligned once the QuiCy repo is public.

Success criteria:

1. A bar renders on every monitor, themed from a JSON file, with live reload.
2. One module per source group works: `battery` (native Quickshell type), `backlight`
   (no type, sysfs), `weather` (HyDE script via the generic `ScriptView`).
3. **Acceptance test for modularity:** a fourth module (`clock`) is activated only by
   dropping a folder into the user directory and adding its id to the user layout (or
   `qs ipc call module load clock`). No core file changes, no shell restart.
4. Runs without HyDE (fallback theme, adapter absent).

Out of scope: notification server, lockscreen, launcher, tooltips/popups, layout style system,
workspaces, tray, autoload of modules, watchdog for frozen QML thread.

## Architecture

Single Quickshell process. Modules are loaded by id through one `Loader` each, so load and
syntax errors stay inside that module (placeholder + log line naming the module).

```text
shell.qml                 entry: one PanelWindow per screen (Variants)
core/
  Theme.qml               singleton, FileView + JsonAdapter, defaults for every value
  ModuleHost.qml          resolves id -> Module.qml, Loader, error placeholder
  Layout.qml              merges default + user layout, per-screen lookup
  Ipc.qml                 IpcHandler: module load|unload|refresh <id>, theme reload, layout reload
services/                 singletons, stable interface over Quickshell types
  Battery.qml  Backlight.qml
components/
  ScriptView.qml          run command, render JSON {text, alt, tooltip, class}
modules/                  shipped modules: battery/ backlight/ weather/
adapters/hyde/            wallbash theme template/path, hyde-shell calls
layouts/default.json
themes/example.json       fallback theme (runs without HyDE)
tests/                    script checks
```

### Locations

| Role | Path |
|---|---|
| System (HyDE-managed, replaced on update) | `~/.local/share/quicy/` (during development: this repo, `qs -p`) |
| User (never touched by updates) | `$XDG_CONFIG_HOME/quicy/` (fallback `~/.config/quicy/`), override with `QUICY_USER_DIR` |
| Generated theme (written by the adapter) | `~/.local/state/quicy/theme.json` |

Theme resolution: generated theme, then `themes/example.json`, then defaults in `Theme.qml`.

### Module contract

- Folder `modules/<id>/` with `Module.qml` (an `Item` with `implicitWidth/Height`) and
  `module.json`: `name`, `api` (required service API version), optional `requires`,
  `type` (`bar` | `window`; only `bar` is built in the PoC, the field reserves the
  distinction for standalone widgets).
- The host passes `moduleId`, `screen`, `config` (object from the layout). Theme and
  services are singletons (`qs.core`, `qs.services`). If the import test (below) fails for
  the user directory, they are passed as properties instead.
- A module may bring its own files (relative imports inside its own folder), including its
  own `Process` logic, so it does not need core changes for data no service provides.
- Heavy work only via `Process`, never in the QML thread (convention).
- A module whose `api` exceeds the host's service API version does not load.

### Layout and overrides

```json
{
  "default": {"edge":"bottom","left":[],"center":[],"right":["battery","backlight","weather"]},
  "screens": {"eDP-1": {"right":["battery","backlight"]}, "DP-1": {"center":["weather"]}}
}
```

- Explicit activation only: a module runs only if its id is in the layout or was loaded by IPC.
- Resolution per id: user dir first, then shipped. Same id in both: user wins (info log).
  A different id (`my-clock`) replaces the shipped one by editing the user layout.
- Layout merge: shipped `layouts/default.json` is HyDE-owned; user `layout.json` is
  user-owned. A zone named in the user layout replaces that zone wholesale; other zones and
  `edge` come from the shipped layout.
- Per screen: `screens.<screen.name>` overrides only the zones/`edge` it names; unknown
  monitor names are ignored; a zone set to `[]` is empty. Bars are separate instances per
  monitor (not mirrored); services are shared singletons.
- Edge cases: duplicate id within one bar (first wins, warning); id without any module
  (placeholder + log); `module load` for a running id (no-op + log).

### Theme

Flat JSON, scope deliberately small:

```json
{"colors":{"bg":"#1e1e2e","fg":"#cdd6f4","accent":"#89b4fa","muted":"#6c7086","warning":"#f9e2af","critical":"#f38ba8"},
 "font":{"family":"sans","size":12},"radius":8,"spacing":6}
```

Missing file, malformed JSON or wrongly typed fields fall back to defaults and log the cause.
Live reload via `watchChanges`; it re-arms the watch on every `fileChanged`, because the
watch may not survive a replace-by-rename write (to be verified against wallbash).

### Services

- `Battery`: `available`, `percent`, `charging`, `state` (`normal|warning|critical`);
  aggregates multiple batteries (the dev machine has two). Wraps UPower.
- `Backlight`: `available`, `percent`, `set(p)`; sysfs read, `brightnessctl` write.
- Missing hardware: `available = false`, the module hides itself.

### ScriptView

Runs a command periodically or as a stream, reads one JSON object per output.
Malformed or empty output keeps the last valid value and shows an error state; process exit
or timeout restarts with backoff; manual refresh via IPC replaces Waybar signals.

## Verification

- Script checks in `tests/` (no framework): theme parsing, ScriptView JSON parsing, layout
  resolution. Each covers missing file/input, malformed content, wrong types, boundary
  values (empty zones, empty output) and unusual combinations (duplicate ids, unknown
  monitor names, same id in user and shipped dir).
- Live checks on Hyprland: theme reload with wallbash's write pattern; user-dir module
  importing `qs.core`/`qs.services`; the `clock` acceptance test.

## Implementation order

1. Scaffold + local git.
2. Install `quickshell` (needs explicit approval), empty bar per monitor.
3. `Theme.qml` + live reload test.
4. `ModuleHost` + layout + placeholder + user-dir import test.
5. `battery`, 6. `backlight`, 7. `ScriptView` + `weather`.
8. HyDE adapter and `[desktop.start] bar` entry (key format from the HyDE schema).
9. README with open questions for the QuiCy discussion.

## Open questions (for the QuiCy discussion)

- Theme scope: colors only, or also borders, rounding, fonts, icons? Source: wallbash JSON, Qt palette (`SystemPalette`), or both behind `Theme.qml`?
- Attributing a frozen QML thread to one module. PoC covers only binding-loop log lines and the
  "heavy work in `Process`" convention; an external watchdog with bisect-restart is a later option.
- Whether user-directory modules can import shell singletons (Quickshell ≥ 0.2.0 import rules).
- Autoload of module folders (optional `autoload` + `slot` in `module.json`), not built.
