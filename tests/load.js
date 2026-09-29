// Loads QML `.pragma library` JS files into node. The pragma line is a syntax
// error outside QML, so it is stripped; files export through a
// `typeof module` guard that is inert inside QML.
const fs = require("node:fs");
const path = require("node:path");

module.exports = function load(rel, root) {
  const file = path.join(root || path.join(__dirname, ".."), rel);
  const src = fs.readFileSync(file, "utf8").replace(/^\.pragma.*$/gm, "");
  const m = { exports: {} };
  new Function("module", src)(m);
  return m.exports;
};
