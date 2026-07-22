#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createPetpackZip } = require("./petpack-zip");
const { validatePetResources, writeQaReport } = require("./qa-petpack-assets");
const { renderVisualQaPage } = require("./render-visual-qa-page");

const root = path.resolve(__dirname, "..");
const petsRoot = path.join(root, "resources", "pets");
const outDir = path.join(root, "release", "petpacks");
const previewsDir = path.join(outDir, "previews");
const stagingRoot = path.join(root, "release", ".petpack-staging");
const SPRITE = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208
};
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listPets() {
  return fs
    .readdirSync(petsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function writePetpackManifest(stagingDir, manifest) {
  const petpackPath = path.join(stagingDir, "petpack.json");
  fs.writeFileSync(
    petpackPath,
    `${JSON.stringify(
      {
        format: "codex-petpack",
        formatVersion: 1,
        id: manifest.id,
        displayName: manifest.displayName || manifest.name || manifest.id,
        version: manifest.version || "1.0.0",
        author: manifest.author,
        license: manifest.license,
        minAppVersion: manifest.minAppVersion,
        tags: manifest.tags || [],
        changelog: manifest.changelog || []
      },
      null,
      2
    )}\n`
  );
  return petpackPath;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(previewsDir, { recursive: true });
fs.mkdirSync(stagingRoot, { recursive: true });

const qaReport = validatePetResources(petsRoot);
if (!qaReport.ok) {
  writeQaReport(qaReport, path.join(outDir, "qa.json"));
  console.error(JSON.stringify(qaReport, null, 2));
  process.exit(1);
}

const index = [];

for (const id of listPets()) {
  const petDir = path.join(petsRoot, id);
  const manifest = readJson(path.join(petDir, "pet.json"));
  const spritesheet = manifest.spritesheetPath || "spritesheet.webp";
  const stagingDir = path.join(stagingRoot, id);
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.copyFileSync(path.join(petDir, "pet.json"), path.join(stagingDir, "pet.json"));
  fs.copyFileSync(path.join(petDir, spritesheet), path.join(stagingDir, spritesheet));
  const careSpritesheet = manifest.care?.spritesheetPath || "";
  if (careSpritesheet) {
    fs.copyFileSync(path.join(petDir, careSpritesheet), path.join(stagingDir, careSpritesheet));
  }
  writePetpackManifest(stagingDir, manifest);
  const fileName = `${id}-${manifest.version || "1.0.0"}.petpack`;
  const outPath = path.join(outDir, fileName);

  if (!fs.existsSync(path.join(petDir, spritesheet))) {
    throw new Error(`Missing spritesheet for ${id}: ${spritesheet}`);
  }

  fs.rmSync(outPath, { force: true });
  const packageFiles = [
    { name: "petpack.json", path: path.join(stagingDir, "petpack.json") },
    { name: "pet.json", path: path.join(stagingDir, "pet.json") },
    { name: spritesheet, path: path.join(stagingDir, spritesheet) }
  ];
  if (careSpritesheet) {
    packageFiles.push({ name: careSpritesheet, path: path.join(stagingDir, careSpritesheet) });
  }
  createPetpackZip(outPath, packageFiles);

  const previewAtlas = `previews/${id}-${manifest.version || "1.0.0"}-atlas.webp`;
  fs.copyFileSync(path.join(petDir, spritesheet), path.join(outDir, previewAtlas));
  const qa = qaReport.pets.find((pet) => pet.id === id) || {};
  qa.previewAtlas = previewAtlas;

  index.push({
    id: manifest.id || id,
    displayName: manifest.displayName || manifest.name || id,
    description: manifest.description || "",
    version: manifest.version || "1.0.0",
    author: manifest.author || "",
    license: manifest.license || "",
    minAppVersion: manifest.minAppVersion || "0.2.0",
    tags: manifest.tags || [],
    changelog: manifest.changelog || [],
    fileName,
    sizeBytes: fs.statSync(outPath).size,
    sha256: sha256(outPath),
    previewAtlas,
    spritesheet,
    care: manifest.care || null,
    sprite: SPRITE,
    qa: {
      ok: qa.ok === true,
      width: qa.width || 0,
      height: qa.height || 0,
      expectedWidth: qaReport.expected.width,
      expectedHeight: qaReport.expected.height,
      previewAtlas
    }
  });
}

fs.writeFileSync(path.join(outDir, "petpacks.json"), `${JSON.stringify(index, null, 2)}\n`);
writeQaReport(qaReport, path.join(outDir, "qa.json"));
fs.writeFileSync(path.join(outDir, "visual-qa.html"), renderVisualQaPage(index));
fs.rmSync(stagingRoot, { recursive: true, force: true });
