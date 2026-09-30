const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const INSTALL = path.join(__dirname, "..", "adapters", "hyde", "install.sh");
const TEMPLATE = path.join(__dirname, "..", "adapters", "hyde", "quicy.dcol");

function fakeHome(withHyde = true) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quicy-home-"));
  if (withHyde) fs.mkdirSync(path.join(home, ".config/hyde/wallbash/always"), { recursive: true });
  return { home, env: { PATH: process.env.PATH, HOME: home } };
}
const run = (env) => spawnSync("sh", [INSTALL], { env, encoding: "utf8" });
const restore = (env, home) => spawnSync("sh", [path.join(home, ".local/share/quicy-backups/latest/restore.sh")], { env, encoding: "utf8" });

test("install copies the template, creates the state dir and saves a backup first", () => {
  const { home, env } = fakeHome();
  const r = run(env);
  assert.equal(r.status, 0, r.stderr);
  const dest = path.join(home, ".config/hyde/wallbash/always/quicy.dcol");
  assert.equal(fs.readFileSync(dest, "utf8"), fs.readFileSync(TEMPLATE, "utf8"));
  assert.equal(fs.statSync(path.join(home, ".local/state/quicy")).isDirectory(), true);
  assert.match(r.stdout, /Restore with/);
});

test("restore after a first install removes the template again", () => {
  const { home, env } = fakeHome();
  run(env);
  assert.equal(restore(env, home).status, 0);
  assert.equal(fs.existsSync(path.join(home, ".config/hyde/wallbash/always/quicy.dcol")), false);
});

test("an existing customised template is backed up and restored", () => {
  const { home, env } = fakeHome();
  const dest = path.join(home, ".config/hyde/wallbash/always/quicy.dcol");
  fs.writeFileSync(dest, "my own version\n");
  run(env);
  assert.notEqual(fs.readFileSync(dest, "utf8"), "my own version\n");
  restore(env, home);
  assert.equal(fs.readFileSync(dest, "utf8"), "my own version\n");
});

test("without a HyDE install nothing is created and the exit code is non-zero", () => {
  const { home, env } = fakeHome(false);
  const r = run(env);
  assert.notEqual(r.status, 0);
  assert.equal(fs.existsSync(path.join(home, ".config")), false);
  assert.equal(fs.existsSync(path.join(home, ".local")), false);
});

test("running install twice keeps the first backup restorable to the original state", () => {
  const { home, env } = fakeHome();
  run(env);
  run(env);
  const dirs = fs.readdirSync(path.join(home, ".local/share/quicy-backups")).filter((d) => d !== "latest" && d !== "install");
  assert.equal(dirs.length, 2);
});

const { fakeHome: fh, sh: shx, restoreLatest } = require("./helpers");

function prepared() {
  const h = fh();
  fs.mkdirSync(path.join(h.home, ".config/Kvantum/wallbash"), { recursive: true });
  fs.writeFileSync(path.join(h.home, ".config/kdeglobals"), "kde original\n");
  fs.writeFileSync(path.join(h.home, ".config/Kvantum/wallbash/wallbash.kvconfig"), "kv original\n");
  fs.writeFileSync(h.db, "[org/test]\nvalue=ORIGINAL\n");
  return h;
}

test("install also saves kdeglobals, the Kvantum config and dconf, and restore brings all back", () => {
  const { home, env, db } = prepared();
  assert.equal(shx("install.sh", env).status, 0);
  fs.writeFileSync(path.join(home, ".config/kdeglobals"), "kde changed by wallbash\n");
  fs.writeFileSync(path.join(home, ".config/Kvantum/wallbash/wallbash.kvconfig"), "kv changed\n");
  fs.writeFileSync(db, "[org/test]\nvalue=CHANGED\n");
  assert.equal(restoreLatest(env, home).status, 0);
  assert.equal(fs.readFileSync(path.join(home, ".config/kdeglobals"), "utf8"), "kde original\n");
  assert.equal(fs.readFileSync(path.join(home, ".config/Kvantum/wallbash/wallbash.kvconfig"), "utf8"), "kv original\n");
  assert.equal(fs.readFileSync(db, "utf8"), "[org/test]\nvalue=ORIGINAL\n");
  assert.equal(fs.existsSync(path.join(home, ".config/hyde/wallbash/always/quicy.dcol")), false);
});

test("install works when those extra files do not exist and restore then removes what appeared", () => {
  const { home, env } = fh();
  assert.equal(shx("install.sh", env).status, 0);
  fs.writeFileSync(path.join(home, ".config/kdeglobals"), "created later\n");
  assert.equal(restoreLatest(env, home).status, 0);
  assert.equal(fs.existsSync(path.join(home, ".config/kdeglobals")), false);
});

test("install keeps a fixed 'install' link to its own backup even when a later backup moves 'latest'", () => {
  const { home, env } = prepared();
  shx("install.sh", env);
  const later = path.join(home, "later.conf");
  fs.writeFileSync(later, "x");
  shx("hyde-backup.sh", env, later);
  const root = path.join(home, ".local/share/quicy-backups");
  assert.notEqual(fs.realpathSync(path.join(root, "latest")), fs.realpathSync(path.join(root, "install")));
  assert.ok(fs.existsSync(path.join(root, "install", "restore.sh")));
});

test("install without dconf still succeeds and says so", () => {
  const { env } = (() => { const h = fh({ dconf: false }); return h; })();
  const r = shx("install.sh", env);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /dconf/);
});
