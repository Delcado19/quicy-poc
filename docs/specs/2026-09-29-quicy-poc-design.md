# QuiCy PoC – Design

Status: implemented and verified live on Hyprland / Quickshell 0.3.1 (2026-09-29); the real wallbash run against the live HyDE install is still open
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
  Theme.qml               singleton, FileView + lib/theme.js parsing, defaults for every value
  ModuleHost.qml          resolves id -> Module.qml, Loader, error placeholder
  BarLayout.qml           merges default + user layout, per-screen lookup, IPC-loaded ids
  Paths.qml               singleton: user/state/shared dirs, host API version
  lib/*.js                pure logic (theme, layout, modules, script, battery, backlight), unit-tested with node
  Ipc.qml                 IpcHandler: module load|unload|refresh <id>, theme reload, layout reload
                          (`load` appends the id to the right zone of every bar; `unload` hides an id, also one
                          from the layout, until `layout reload`)
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
  `module.json`: `name`, `api` (required service API version), optional `requires`, `options`,
  `type` (`bar` | `window`; only `bar` is built in the PoC, the field reserves the
  distinction for standalone widgets).
- The host passes `moduleId`, `screen` and `meta` (the parsed `module.json`; its optional `options` object carries per-module settings such as the script command). Theme and
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
  If a user module fails to load (syntax error, missing files) the host logs a warning and falls back to
  the next candidate; the placeholder appears only when every candidate fails.
- Layout merge: shipped `layouts/default.json` is HyDE-owned; user `layout.json` is
  user-owned. A zone named in the user layout replaces that zone wholesale; other zones and
  `edge` come from the shipped layout.
- Per screen: `screens.<screen.name>` overrides only the zones/`edge` it names; unknown
  monitor names are ignored; a zone set to `[]` is empty. Bars are separate instances per
  monitor (not mirrored); services are shared singletons.
- Edge cases: duplicate id within one bar (first wins, warning); id without any module
  (placeholder + log); `module load` for an id that is already shown and `module unload` for an id that is not shown return "no change" to the IPC caller (nothing is logged).

### Theme

Flat JSON, scope deliberately small:

```json
{"colors":{"bg":"#1e1e2e","fg":"#cdd6f4","accent":"#89b4fa","muted":"#6c7086","warning":"#f9e2af","critical":"#f38ba8"},
 "font":{"family":"sans","size":12},"radius":8,"spacing":6}
```

Missing file, malformed JSON or wrongly typed fields fall back to defaults and log the cause.
Live reload via `watchChanges`. Verified: the watch survives replace-by-rename writes (wallbash
writes with `mktemp` + `mv`), no re-arming needed. wallbash does not create the target directory
and skips the template if it is missing, and a watch cannot be armed on a missing directory, so
`Theme.qml` runs one idle shell that waits for the file (it exits with quickshell).

### Services

- `Battery`: `available`, `percent`, `charging`, `state` (`normal|warning|critical`);
  wraps the UPower display device, which UPower already aggregates across batteries (the dev machine has two).
- `Backlight`: `available`, `percent`, `set(p)`; `brightnessctl -m` read (avoids globbing sysfs from QML), `brightnessctl set` write.
- Missing hardware: `available = false`, the module hides itself.

### ScriptView

Runs a command periodically or as a stream, reads one JSON object per output.
Malformed or empty output keeps the last valid value and shows an error state; process exit
or timeout restarts with backoff (only a run that lasted 10 s resets the delay, so a one-shot script used without an interval is not restarted every second); every run is wrapped in coreutils `timeout` (a real timeout for periodic runs, duration 0 for streams) so the whole process group dies with the run; polling intervals have a one-second floor; a periodic or stream run that printed nothing shows the error state; manual refresh via IPC replaces Waybar signals.

## Verification

- Pure-logic checks in `tests/` (`node --test`, no dependencies): theme parsing, ScriptView JSON parsing, layout
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
- ~~Whether user-directory modules can import shell singletons~~ Resolved: verified with Quickshell 0.3.1, a module loaded from a directory outside the shell tree (`QUICY_USER_DIR`) can `import qs.core` / `qs.services` and shares the same singleton instances (it follows a live theme change). The `theme` property fallback is not needed.
- Autoload of module folders (optional `autoload` + `slot` in `module.json`), not built.
