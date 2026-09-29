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
- The colour mapping follows the existing wayle bridge in `~/.config/hyde/wallbash/scripts`:
  `pry1` background, `txt1` foreground, `1xa7` accent, `3xa6` muted, `1xa6` warning, `1xa8` critical.

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

## Not yet verified

A real wallbash run with the template has not been executed against the live HyDE install (it
needs a backup and your go-ahead first). Until then the template format is verified only by
reading `color.set.sh`.
