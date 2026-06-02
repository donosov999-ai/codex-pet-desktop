#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(packageJson.version || "").trim();
const expectedTag = `v${version}`;
const refType = process.env.GITHUB_REF_TYPE || "";
const ref = process.env.GITHUB_REF || "";
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || ref.replace(/^refs\/tags\//, "");
const isTagRef = refType === "tag" || ref.startsWith("refs/tags/") || /^v\d+\.\d+\.\d+$/.test(tag);

function writeJson(stream, value) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (!version) {
  writeJson(process.stderr, {
    ok: false,
    reason: "missing package version"
  });
  process.exit(1);
}

if (!isTagRef) {
  writeJson(process.stdout, {
    ok: true,
    reason: "not a tag release",
    version,
    expectedTag
  });
  process.exit(0);
}

if (tag !== expectedTag) {
  writeJson(process.stderr, {
    ok: false,
    reason: "release tag mismatch",
    tag,
    expectedTag,
    version
  });
  process.exit(1);
}

writeJson(process.stdout, {
  ok: true,
  tag,
  version
});
