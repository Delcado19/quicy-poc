const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "..", "adapters", "hyde", "hyde-backup.sh");

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quicy-home-"));
  return { home, env: { PATH: process.env.PATH, HOME: home } };
}
const run = (env, ...args) => spawnSync("sh", [SCRIPT, ...args], { env, encoding: "utf8" });
const restoreOf = (home) => path.join(home, ".local/share/quicy-backups/latest/restore.sh");
const doRestore = (env, home) => spawnSync("sh", [restoreOf(home)], { env, encoding: "utf8" });

test("an existing file is restored to its original content", () => {
  const { home, env } = fakeHome();
  const f = path.join(home, ".config/hyde/config.toml");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, "original\n");
  const r = run(env, f);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /restore\.sh/);
  fs.writeFileSync(f, "changed\n");
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(fs.readFileSync(f, "utf8"), "original\n");
});

test("a file that did not exist is removed again on restore", () => {
  const { home, env } = fakeHome();
  const f = path.join(home, ".config/hyde/wallbash/always/quicy.dcol");
  assert.equal(run(env, f).status, 0);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, "new\n");
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(fs.existsSync(f), false);
});

test("restore never removes a directory that appeared at the path", () => {
  const { home, env } = fakeHome();
  const f = path.join(home, "thing");
  assert.equal(run(env, f).status, 0);
  fs.mkdirSync(f);
  fs.writeFileSync(path.join(f, "keep"), "x");
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(fs.existsSync(path.join(f, "keep")), true);
});

test("paths with spaces and quotes survive the round trip", () => {
  const { home, env } = fakeHome();
  const f = path.join(home, "my dir", "it's a file.conf");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, "a\n");
  assert.equal(run(env, f).status, 0);
  fs.writeFileSync(f, "b\n");
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(fs.readFileSync(f, "utf8"), "a\n");
});

test("a symlink is restored as a symlink to the same target", () => {
  const { home, env } = fakeHome();
  const target = path.join(home, "dotfiles/config.toml");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "T\n");
  const link = path.join(home, "config.toml");
  fs.symlinkSync(target, link);
  assert.equal(run(env, link).status, 0);
  fs.unlinkSync(link);
  fs.writeFileSync(link, "replaced by a regular file\n");
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(link), target);
});

test("several files in one backup are all restored", () => {
  const { home, env } = fakeHome();
  const a = path.join(home, "a"), b = path.join(home, "sub/b"), c = path.join(home, "c");
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.writeFileSync(a, "A"); fs.writeFileSync(b, "B");
  assert.equal(run(env, a, b, c).status, 0);
  fs.writeFileSync(a, "x"); fs.writeFileSync(b, "y"); fs.writeFileSync(c, "z");
  assert.equal(doRestore(env, home).status, 0);
  assert.deepEqual([fs.readFileSync(a, "utf8"), fs.readFileSync(b, "utf8"), fs.existsSync(c)], ["A", "B", false]);
});

test("restore can be run twice", () => {
  const { home, env } = fakeHome();
  const f = path.join(home, "f");
  fs.writeFileSync(f, "1");
  run(env, f);
  fs.writeFileSync(f, "2");
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(doRestore(env, home).status, 0);
  assert.equal(fs.readFileSync(f, "utf8"), "1");
});

test("two backups in the same second do not overwrite each other", () => {
  const { home, env } = fakeHome();
  const f = path.join(home, "f");
  fs.writeFileSync(f, "1");
  run(env, f);
  fs.writeFileSync(f, "2");
  run(env, f);
  const dirs = fs.readdirSync(path.join(home, ".local/share/quicy-backups")).filter((d) => d !== "latest");
  assert.equal(dirs.length, 2);
});

test("bad input is refused and creates no backup", () => {
  const { home, env } = fakeHome();
  const outside = path.join(os.tmpdir(), "quicy-outside-file");
  fs.writeFileSync(outside, "x");
  fs.mkdirSync(path.join(home, "d"));
  fs.writeFileSync(path.join(home, "ok"), "ok");
  const cases = [[], [outside], [path.join(home, "d")], [path.join(home, "..", "x")], [path.join(home, "sub/../../x")], ["relative/path"], [""], [path.join(home, "ok"), outside]];
  for (const args of cases) {
    const r = run(env, ...args);
    assert.notEqual(r.status, 0, JSON.stringify(args));
  }
  assert.equal(fs.existsSync(path.join(home, ".local/share/quicy-backups")), false);
});

test("unset HOME is refused", () => {
  const r = spawnSync("sh", [SCRIPT, "/x"], { env: { PATH: process.env.PATH }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
});
