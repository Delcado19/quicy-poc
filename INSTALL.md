# Installing quicy-poc on HyDE

This is a proof of concept. It runs next to your existing setup and every step that changes your HyDE
configuration is backed up first and can be undone with one command. Tested on Arch Linux with Hyprland
0.56, Quickshell 0.3.1 and a single laptop monitor; other setups are untested.

## What gets changed, and what does not

| Step | Changes | Undo |
|---|---|---|
| 1. Packages | installs `quickshell` and `brightnessctl` | your package manager |
| 2. Shell files | one directory, `~/.local/share/quicy` | delete the directory |
| 3. Start by hand | nothing (a Quickshell process, closed with `pkill -x qs`) | `pkill -x qs` |
| 4. HyDE theme hook | adds `~/.config/hyde/wallbash/always/quicy.dcol`, creates `~/.local/state/quicy/` | `uninstall.sh` |
| 5. Autostart (optional) | edits `~/.config/hyde/config.toml` | restore your backup of it |

Nothing here touches Waybar, dunst or your other HyDE files. Step 4 does add a wallbash template, so
from then on every wallpaper or theme change also writes `~/.local/state/quicy/theme.json`.

## 1. Requirements

- Quickshell 0.3 or newer, Hyprland
- `brightnessctl` (backlight module) and coreutils `timeout` (script modules, e.g. weather)
- `hyde-shell` for the weather module (without it that module stays empty)
- A Nerd Font for the battery icons and the Waybar-matching look: JetBrainsMono Nerd Font, which HyDE
  installs. Without it icons show as boxes; the battery note in the README's Modules section explains how to use plain text instead.

On Arch: `sudo pacman -S --needed quickshell brightnessctl`

## 2. Get the files

```sh
git clone https://github.com/Delcado19/quicy-poc ~/.local/share/quicy
```

(Any other location works too; use it in place of `~/.local/share/quicy` below.)

## 3. Try it without touching HyDE

```sh
qs -p ~/.local/share/quicy
```

A bar appears at the bottom edge of every monitor (Waybar stays where it is) and uses the fallback
theme. Close it again with `pkill -x qs`, which only matches Quickshell.

## 4. Follow your HyDE theme

```sh
sh ~/.local/share/quicy/adapters/hyde/install.sh
```

This first saves, in `~/.local/share/quicy-backups/<timestamp>/`, the files that wallbash can rewrite
(`~/.config/kdeglobals`, `~/.config/Kvantum/wallbash/wallbash.kvconfig`), the dconf settings and the
template path itself, then installs the template. The next wallpaper or theme change generates
`~/.local/state/quicy/theme.json`, and a running bar picks it up live.

To generate it right away without changing the wallpaper:

```sh
hyde-shell color.set.sh --single ~/.config/hyde/wallbash/always/quicy.dcol
```

That also runs wallbash's usual kdeglobals/Kvantum/dconf step and reloads Hyprland once; the backup from
the install covers it.

## 5. Autostart (optional)

`[desktop.start] bar` in `~/.config/hyde/config.toml` takes the bar command. This replaces Waybar's
entry, so decide whether you want that. Back the file up first:

```sh
sh ~/.local/share/quicy/adapters/hyde/hyde-backup.sh ~/.config/hyde/config.toml
```

The command prints `Backup saved in <DIR>`; note that `<DIR>`. Then add:

```toml
[desktop.start]
bar = "hyde-shell app -u hyde-$XDG_SESSION_DESKTOP-bar.scope -t scope -- qs -p ~/.local/share/quicy"
```

I only tested starting the bar by hand (step 3), not this autostart entry. To keep Waybar as well, start
`qs -p ~/.local/share/quicy` from your Hyprland autostart instead and leave `bar` alone.

To undo this step: `sh <DIR>/restore.sh` with the directory you noted.

## Check that it works

```sh
qs -p ~/.local/share/quicy ipc show     # lists the targets: module, theme, layout, shell
```

You should see battery, brightness and the weather text at the right of the bar, in the colours of your
current HyDE theme. Hover the weather entry for the detailed forecast.

## Undo everything

```sh
sh ~/.local/share/quicy/adapters/hyde/uninstall.sh
```

This runs the restore of the step 4 backup (template removed; `kdeglobals`, the Kvantum config and the
dconf settings back to what they were before the install) and deletes the generated
`~/.local/state/quicy/theme.json` and, if empty, that directory. Then `pkill -x qs` and delete
`~/.local/share/quicy` if you want the shell gone as well.

What the restore does and does not do:

- It brings back the files it saved and removes a saved file that did not exist before. It only ever
  removes files and links, never directories.
- `dconf load` merges: settings that were created after the backup stay.
- It does not touch `config.toml`; use the separate backup from step 5 for that.
- It does not undo package installation.
- Running it twice is harmless. After a second install it still returns to the state before the *first*
  install.

Backups stay in `~/.local/share/quicy-backups/` until you delete them. `latest` points at the most recent
one, `install` at the one `uninstall.sh` uses.

## Problems

- Bar does not appear: run `qs -p ~/.local/share/quicy` in a terminal and read the log.
- Colours do not change: check that `~/.local/state/quicy/theme.json` exists and is valid JSON
  (`jq . ~/.local/state/quicy/theme.json`). wallbash silently skips a template whose target directory
  is missing; `install.sh` creates it.
- Weather empty: run `hyde-shell weather` in a terminal to see what it prints.
- Tests: `sh ~/.local/share/quicy/tests/run.sh` (needs Node.js and `qmlformat`).
