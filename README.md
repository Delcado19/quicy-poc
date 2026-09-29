# quicy-poc

A proof of concept for a modular Quickshell bar in HyDE ([Discussion #2038](https://github.com/HyDE-Project/HyDE/discussions/2038)).
It is candidate content for the QuiCy repo, not a competing product: names and conventions
(`core/Theme.qml`, one folder per module, IPC-driven, one Quickshell process) follow the discussion
and are meant to be aligned with QuiCy once its layout is public.

It answers, early and cheaply, whether the module/override architecture works and whether the
Waybar-style pieces (native types, plain files, HyDE scripts) fit into it. It is a bar only; no
notification server, lockscreen, launcher, tooltips or popups.

## Requirements

- Quickshell 0.3.x (developed on 0.3.1)
- `brightnessctl` (backlight module), coreutils `timeout` (every script module runs under it so hung children die with the run)
- Node 20+ for the tests, `qmlformat` for the QML syntax check
- HyDE is optional: without it the shell runs on `themes/example.json`

## Run

```sh
qs -p .                      # from this directory
QUICY_USER_DIR=/some/dir qs -p .
```

## Layout of the tree

```text
shell.qml            entry point: one PanelWindow per monitor
core/                Theme, BarLayout, ModuleHost, Ipc, Paths (+ lib/*.js: pure logic)
services/            singletons with a stable interface over Quickshell types (Battery, Backlight)
components/          ScriptView: runs a command and renders Waybar-style JSON
modules/             shipped modules: battery, backlight, weather, hello (host test module)
adapters/hyde/       everything HyDE-specific (wallbash template, backup/install scripts)
layouts/default.json shipped layout        themes/example.json fallback theme
examples/user/       an example user module (clock)
tests/               node tests for the pure logic and the shell scripts
```

## Directories

| Role | Path |
|---|---|
| System (HyDE-managed) | `~/.local/share/quicy/` (during development this repository) |
| User (never touched by updates) | `$XDG_CONFIG_HOME/quicy/`, fallback `~/.config/quicy/`, override with `QUICY_USER_DIR` |
| Generated theme | `~/.local/state/quicy/theme.json` (state dir override: `QUICY_STATE_DIR`) |

## Modules

A module is a folder `modules/<id>/` with a `module.json` and a `Module.qml`.

```json
{"name": "weather", "api": 1, "options": {"command": ["hyde-shell", "weather"], "interval": 3600000}}
```

- `api` is the service API version the module was written against; the host is at version 1 and
  refuses newer modules. `type` is `bar` (default) or `window` (reserved, only `bar` is built).
  `options` is free-form per-module configuration.
- `Module.qml` is an `Item` that declares `required property string moduleId`, `required property var screen`
  and `required property var meta` (the parsed `module.json`). It can `import qs.core` (Theme) and
  `import qs.services`, also when it is loaded from the user directory.
- Heavy work belongs in `Process`, never in the QML thread.
- Ids match `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`; anything else is rejected before a path is built.

### Activating and overriding

Activation is explicit. A module runs only if its id is in the layout or was loaded over IPC.

- Put a folder into `<user dir>/modules/<id>/` and add the id to `<user dir>/layout.json`, or run
  `qs -p . ipc call module load <id>`.
- Resolution per id: user directory first, then the shipped module. The same id in both means the
  user's module wins; a different id (`my-clock`) replaces the shipped one by editing the layout.
- If a user module fails to load (syntax error, missing files, too-new `api`), the host logs a
  warning and falls back to the shipped module; the placeholder only shows if every candidate fails.

### Layout

```json
{
  "default": {"edge": "bottom", "left": [], "center": [], "right": ["battery", "backlight", "weather"]},
  "screens": {"eDP-1": {"right": ["battery"]}}
}
```

A zone named in the user layout replaces the shipped zone wholesale; other zones and `edge` come
from the shipped layout. `screens.<monitor name>` overrides only the zones it names, per monitor;
unknown monitor names are ignored. Each monitor gets its own bar and its own module instances (not
mirrored). Duplicate ids within one bar are ignored (first wins). A malformed user layout is
reported and ignored, the shipped layout stays in effect.

## IPC

`qs -p . ipc show` lists everything. Targets:

| Call | Effect |
|---|---|
| `module load <id>` / `module unload <id>` | append an id to the right zone of every bar / hide it until `layout reload`; both answer "no change" if there is nothing to do |
| `module refresh <id>` | re-run a script module now |
| `theme reload` / `layout reload` | re-read files (`layout reload` also clears load/unload state) |
| `shell reload` | reload the whole config; needed after editing a module's QML |

## Theme

`core/Theme.qml` reads a flat JSON file: six colours (`bg fg accent muted warning critical`), `font.family`,
`font.size`, `radius`, `spacing`. Every value has a default; invalid fields fall back individually and
are logged. Sources in priority order: the generated file, `themes/example.json`, the defaults. A
file caught mid-write keeps the last good theme. The watcher survives replace-by-rename writes
(tested on Quickshell 0.3.1); a small idle shell waits for the file when its directory does not exist
yet.

## HyDE

See `adapters/hyde/README.md`. Short version: `sh adapters/hyde/install.sh` (backs up first; undo with
`sh ~/.local/share/quicy-backups/latest/restore.sh`).

## Tests

```sh
sh tests/run.sh
```

Node tests cover the parsing/merge logic and the backup/install scripts, including malformed and
missing input and boundary values. The QML wiring is checked for syntax only; behaviour was
verified live on Hyprland (see the plan and spec for the scenarios).

## Known limitations

- Any layout change rebuilds all modules of all bars (a `weather` script runs again).
- `module unload`/`load` does not pick up edited QML (Qt caches components); use `shell reload`.
- A frozen QML thread (endless loop in a module) freezes the whole shell and cannot be attributed to
  a module. The PoC only avoids it by convention (heavy work in `Process`); an external watchdog
  with bisecting restarts is a possible later step.
- The backlight poll stops after three polls without a valid reading (e.g. `brightnessctl` missing or no `backlight` class device; LEDs are ignored).
- Killing quickshell with SIGTERM leaves the children of stream scripts running (`ScriptView` ends them when it stops a run, but nothing reaps them when the whole shell dies). Periodic runs end with their timeout.
- A stream script that exits is restarted with a growing delay (1 s up to 1 min); only a run longer than 10 s resets it. Polling intervals below one second are raised to one second.
- A module scrolled quickly can lose backlight steps (each wheel event is computed from the last read value).
- Stream output without newlines is buffered without limit.
- Only one monitor was available for testing; per-monitor overrides were exercised through the
  monitor's own `screens` entry.
- A real wallbash run with the template has not been executed against the live HyDE install.

## Open questions for the QuiCy discussion

- Theme scope: colours only, or also borders, rounding, fonts, icons? Source wallbash JSON, Qt
  palette (`SystemPalette`), or both behind `Theme.qml`?
- How to attribute a frozen QML thread to one module.
- Whether module folders should be autoloaded (`autoload` + `slot` in `module.json`); not built.
- `type: "window"` modules (standalone widgets) are reserved in `module.json` but not implemented.
