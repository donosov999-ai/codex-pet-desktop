#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const petsRoot = path.join(root, "resources", "pets");

function listPetManifestPaths() {
  if (!fs.existsSync(petsRoot)) {
    return [];
  }
  return fs
    .readdirSync(petsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(petsRoot, entry.name, "pet.json"))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .sort();
}

function formatPetJson(manifestPath) {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const formatted = `${JSON.stringify(parsed, null, 2)}\n`;
  fs.writeFileSync(manifestPath, formatted);
  return path.relative(root, manifestPath);
}

function formatAllPetJson() {
  return listPetManifestPaths().map(formatPetJson);
}

if (require.main === module) {
  const formatted = formatAllPetJson();
  console.log(JSON.stringify({ ok: true, formatted }, null, 2));
}

module.exports = {
  formatAllPetJson,
  formatPetJson,
  listPetManifestPaths
};
