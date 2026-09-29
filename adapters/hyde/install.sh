#!/bin/sh
# Installs the wallbash template that writes QuiCy's theme.json into the user's
# HyDE config. Everything it touches is backed up first (see hyde-backup.sh);
# the last line printed tells how to undo it.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
hyde_dir="$HOME/.config/hyde/wallbash/always"
dest="$hyde_dir/quicy.dcol"

# Without a HyDE install there is nothing to hook into; do not create one.
[ -d "$hyde_dir" ] || { echo "no HyDE wallbash directory at $hyde_dir, nothing installed" >&2; exit 1; }

sh "$here/hyde-backup.sh" "$dest"

# wallbash skips a template whose target directory does not exist (it never
# creates it), so the state directory must be there before the first run.
mkdir -p "$HOME/.local/state/quicy"
cp "$here/quicy.dcol" "$dest"
echo "Installed $dest (run a wallpaper/theme change to generate theme.json)"
