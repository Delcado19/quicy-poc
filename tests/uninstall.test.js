const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fakeHome, sh } = require("./helpers");

function installed() {
  const h = fakeHome();
  fs.mkdirSync(path.join(h.home, ".config/Kvantum/wallbash"), { recursive: true });
  fs.writeFileSync(path.join(h.home, ".config/kdeglobals"), "kde original\n");
  fs.writeFileSync(h.db, "[org/test]\nvalue=ORIGINAL\n");
  assert.equal(sh("install.sh", h.env).status, 0);
  // what wallbash would do afterwards
  const state = path.join(h.home, ".local/state/quicy");
  fs.writeFileSync(path.join(state, "theme.json"), "{}");
  fs.writeFileSync(path.join(h.home, ".config/kdeglobals"), "kde changed\n");
  fs.writeFileSync(h.db, "[org/test]\nvalue=CHANGED\n");
  return { ...h, state };
}

test("uninstall restores the saved files and dconf and removes the generated theme and its empty directory", () => {
  const { home, env, db, state } = installed();
  const r = sh("uninstall.sh", env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(path.join(home, ".config/hyde/wallbash/always/quicy.dcol")), false);
  assert.equal(fs.readFileSync(path.join(home, ".config/kdeglobals"), "utf8"), "kde original\n");
  assert.equal(fs.readFileSync(db, "utf8"), "[org/test]\nvalue=ORIGINAL\n");
  assert.equal(fs.existsSync(state), false);
});

test("uninstall leaves the state directory alone when it holds foreign files", () => {
  const { env, state } = installed();
  fs.writeFileSync(path.join(state, "mine.txt"), "keep");
  const r = sh("uninstall.sh", env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(path.join(state, "mine.txt")), true);
  assert.equal(fs.existsSync(path.join(state, "theme.json")), false);
});

test("uninstall still finds its own backup after a newer, unrelated backup moved 'latest'", () => {
  const { home, env } = installed();
  const other = path.join(home, "other.conf");
  fs.writeFileSync(other, "o");
  sh("hyde-backup.sh", env, other);
  assert.equal(sh("uninstall.sh", env).status, 0);
  assert.equal(fs.existsSync(path.join(home, ".config/hyde/wallbash/always/quicy.dcol")), false);
  assert.equal(fs.readFileSync(path.join(home, ".config/kdeglobals"), "utf8"), "kde original\n");
});

test("uninstall without any install backup fails and removes nothing", () => {
  const h = fakeHome();
  const state = path.join(h.home, ".local/state/quicy");
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, "theme.json"), "{}");
  const r = sh("uninstall.sh", h.env);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /backup/i);
  assert.equal(fs.existsSync(path.join(state, "theme.json")), true);
});

test("uninstall refuses a backup directory whose restore.sh was not written by hyde-backup.sh", () => {
  const h = fakeHome();
  const evil = path.join(h.home, "evil");
  fs.mkdirSync(evil);
  fs.writeFileSync(path.join(evil, "restore.sh"), "#!/bin/sh\ntouch \"$HOME/pwned\"\n");
  const r = sh("uninstall.sh", h.env, evil);
  assert.notEqual(r.status, 0);
  assert.equal(fs.existsSync(path.join(h.home, "pwned")), false);
});

test("uninstall accepts an explicit backup directory and can run twice", () => {
  const { home, env } = installed();
  const dir = fs.realpathSync(path.join(home, ".local/share/quicy-backups/install"));
  assert.equal(sh("uninstall.sh", env, dir).status, 0);
  assert.equal(sh("uninstall.sh", env, dir).status, 0);
});

test("after installing twice, uninstall still returns to the state before the first install", () => {
  const { home, env } = installed();
  assert.equal(sh("install.sh", env).status, 0);            // second install
  assert.equal(sh("uninstall.sh", env).status, 0);
  assert.equal(fs.existsSync(path.join(home, ".config/hyde/wallbash/always/quicy.dcol")), false);
  assert.equal(fs.readFileSync(path.join(home, ".config/kdeglobals"), "utf8"), "kde original\n");
});

test("uninstall then install again works and uninstalls to the state before that new install", () => {
  const { home, env } = installed();
  assert.equal(sh("uninstall.sh", env).status, 0);
  fs.writeFileSync(path.join(home, ".config/kdeglobals"), "kde v2\n");
  assert.equal(sh("install.sh", env).status, 0);
  fs.writeFileSync(path.join(home, ".config/kdeglobals"), "kde v3\n");
  assert.equal(sh("uninstall.sh", env).status, 0);
  assert.equal(fs.readFileSync(path.join(home, ".config/kdeglobals"), "utf8"), "kde v2\n");
});
