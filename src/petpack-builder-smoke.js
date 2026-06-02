#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts", "build-petpacks.js"), "utf8");

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

const forbidden = [
  "node:child_process",
  "spawnSync",
  'sh("zip"',
  "sh('zip'"
].filter((pattern) => source.includes(pattern));

if (forbidden.length) {
  fail("petpack builder must not depend on external zip commands", { forbidden });
}

for (const expected of ["function createPetpackZip", "function crc32", "function writeUInt32LE"]) {
  if (!source.includes(expected)) {
    fail("petpack builder is missing pure JavaScript zip helpers", { expected });
  }
}

console.log(JSON.stringify({ ok: true }, null, 2));
