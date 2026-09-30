#!/bin/sh
# Installs the wallbash template that writes QuiCy's theme.json into the user's
# HyDE config. Everything that the template hook or wallbash can change is
# backed up first (see hyde-backup.sh), and `uninstall.sh` undoes it.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
hyde_dir="$HOME/.config/hyde/wallbash/always"
dest="$hyde_dir/quicy.dcol"

# Without a HyDE install there is nothing to hook into; do not create one.
[ -d "$hyde_dir" ] || { echo "no HyDE wallbash directory at $hyde_dir, nothing installed" >&2; exit 1; }

# The template itself, plus what every wallbash render rewrites (kdeglobals and
# the Kvantum config) and the dconf settings it sets, so the restore brings the
# original HyDE state back.
out=$(sh "$here/hyde-backup.sh" --dconf "$dest" "$HOME/.config/kdeglobals" "$HOME/.config/Kvantum/wallbash/wallbash.kvconfig")
printf '%s\n' "$out"

# `latest` moves with every later backup (for example one of config.toml);
# `install` points at the backup made by the FIRST install and is only set
# once, so a repeated install (which would back up the already installed
# template) cannot make uninstall.sh restore the wrong state.
backup_dir=$(printf '%s\n' "$out" | sed -n 's/^Backup saved in //p')
[ -L "$(dirname "$backup_dir")/install" ] || ln -sfn "$backup_dir" "$(dirname "$backup_dir")/install"

# wallbash skips a template whose target directory does not exist (it never
# creates it), so the state directory must be there before the first run.
mkdir -p "$HOME/.local/state/quicy"
cp "$here/quicy.dcol" "$dest"
echo "Installed $dest (run a wallpaper/theme change to generate theme.json)"
echo "Undo everything with: sh $here/uninstall.sh"
