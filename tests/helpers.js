// Shared setup for the shell-script tests: a throw-away HOME and a fake
// `dconf` that keeps its "database" in a file inside that HOME, so nothing
// touches the real desktop settings.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ADAPTER = path.join(__dirname, "..", "adapters", "hyde");

function fakeHome({ hyde = true, dconf = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quicy-home-"));
  if (hyde) fs.mkdirSync(path.join(home, ".config/hyde/wallbash/always"), { recursive: true });
  const bin = path.join(home, "fakebin");
  fs.mkdirSync(bin);
  if (dconf) {
    fs.writeFileSync(path.join(bin, "dconf"), `#!/bin/sh
db="$HOME/.fake-dconf-db"
case "$1" in
  dump) [ -f "$db" ] && cat "$db" || printf '[org/test]\\nvalue=0\\n' ;;
  load) cat > "$db" ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 });
  }
  // The scripts get a PATH made of the fake dconf (if any) and symlinks to the
  // few system tools they need. The real `dconf` must never be reachable:
  // a restore in a test would otherwise load settings into the real desktop.
  const tools = path.join(home, "tools");
  fs.mkdirSync(tools);
  for (const t of ["sh", "cat", "cp", "rm", "mkdir", "ln", "date", "dirname", "readlink", "sed", "chmod", "mv", "rmdir", "tr", "grep", "touch", "head", "basename", "wc", "ls", "test", "printf", "env"]) {
    const found = spawnSync("sh", ["-c", `command -v ${t}`], { encoding: "utf8" }).stdout.trim();
    if (found.startsWith("/")) fs.symlinkSync(found, path.join(tools, t));
  }
  return { home, env: { PATH: `${bin}:${tools}`, HOME: home }, db: path.join(home, ".fake-dconf-db") };
}

const sh = (script, env, ...args) => spawnSync("sh", [path.join(ADAPTER, script), ...args], { env, encoding: "utf8" });
const restoreLatest = (env, home) => spawnSync("sh", [path.join(home, ".local/share/quicy-backups/latest/restore.sh")], { env, encoding: "utf8" });

module.exports = { fakeHome, sh, restoreLatest, ADAPTER };
