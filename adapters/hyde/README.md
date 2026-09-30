# HyDE adapter

Everything HyDE-specific lives here. The shell itself only reads a theme file and knows nothing
about wallbash.

| File | Purpose |
|---|---|
| `quicy.dcol` | wallbash template that writes `~/.local/state/quicy/theme.json` on every wallpaper/theme change |
| `install.sh` | Backs up what it touches, creates the state directory, copies the template into `~/.config/hyde/wallbash/always/` |
| `hyde-backup.sh` | Saves files under `$HOME` and writes a `restore.sh` next to the copies |

## Install and undo

```sh
sh adapters/hyde/install.sh
# undo, one command:
sh ~/.local/share/quicy-backups/latest/restore.sh
```

`hyde-backup.sh` accepts regular files and symlinks under `$HOME` only (never directories, never
paths with `..`). A file that did not exist before is recorded as absent, so restoring deletes it
again. Restoring leaves the (empty) state directory `~/.local/state/quicy` in place.

## How wallbash treats the template

Read from `~/.local/lib/hyde/color.set.sh` (HyDE, Sep 2026):

- Line 1 is `target|command`. The target is `eval`ed, so `${HOME}` works. The command after `|`
  is empty here.
- wallbash **skips a template whose target directory does not exist** ("skip 'missing directory'")
  and never creates it. That is why `install.sh` creates `~/.local/state/quicy`.
- The rendered file is written with `mktemp` + `mv`, i.e. replace-by-rename. The theme watcher in
  `core/Theme.qml` was tested with exactly this write pattern.
- Colour mapping: `pry1` background, `txt1` foreground, `1xa7` accent, `3xa6` muted, following the
  existing wayle bridge in `~/.config/hyde/wallbash/scripts`. `warning` (amber `#F5A524`) and
  `critical` (red `#E5484D`) are fixed on purpose: wallbash derives the nine accents `xa1`..`xa9` of
  a primary from that primary's hue, so every palette-derived colour has the wallpaper's hue and,
  with similar primaries, even the same value (`1xa6` and `3xa6` were both `#C2807A`). On a blue
  wallpaper a derived "critical" would be blue. Status colours must not depend on the wallpaper to
  stay recognisable; the chosen values are readable on dark and light backgrounds.

## Starting the shell from HyDE

`[desktop.start]` in `~/.config/hyde/config.toml` takes the bar command as a string. The default
(from the HyDE config schema) is
`hyde-shell app -u hyde-$XDG_SESSION_DESKTOP-bar.scope -t scope -- waybar.py --watch`.
A QuiCy entry would be:

```toml
[desktop.start]
bar = "hyde-shell app -u hyde-$XDG_SESSION_DESKTOP-bar.scope -t scope -- qs -p ~/.local/share/quicy"
```

This snippet is **not applied automatically**. It assumes the shell tree is installed at
`~/.local/share/quicy` (copy or link this repository there); the PoC has no installer for that
part. Back up `config.toml` with `hyde-backup.sh` before editing it, and note that Waybar keeps
running until the default `bar` entry is replaced.

## Verified against the live install (2026-09-30)

`hyde-shell color.set.sh --single ~/.config/hyde/wallbash/always/quicy.dcol` rendered the template
through the real pipeline: valid JSON in `~/.local/state/quicy/theme.json` (written with `mktemp` +
`mv`), and the bar picked it up. Caveats:

- Even `--single` first runs wallbash's kdeglobals/Kvantum/dconf step and reloads Hyprland, so back
  those up before running it by hand. On the tested machine they were byte-identical afterwards.
- `--dcol <other palette>` does not change the rendered colours with `--single` (the substitutions
  are prepared before the override is read), so it cannot be used to force a visible colour change.
