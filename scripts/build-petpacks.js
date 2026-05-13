#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const petsRoot = path.join(root, "resources", "pets");
const outDir = path.join(root, "release", "petpacks");
const stagingRoot = path.join(root, "release", ".petpack-staging");

function sh(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

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
        version: manifest.version || "1.0.0"
      },
      null,
      2
    )}\n`
  );
  return petpackPath;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(stagingRoot, { recursive: true });

const index = [];

for (const id of listPets()) {
  const petDir = path.join(petsRoot, id);
  const manifest = readJson(path.join(petDir, "pet.json"));
  const spritesheet = manifest.spritesheetPath || "spritesheet.webp";
  const stagingDir = path.join(stagingRoot, id);
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.copyFileSync(path.join(petDir, "pet.json"), path.join(stagingDir, "pet.json"));
  fs.copyFileSync(path.join(petDir, spritesheet), path.join(stagingDir, spritesheet));
  writePetpackManifest(stagingDir, manifest);
  const fileName = `${id}-${manifest.version || "1.0.0"}.petpack`;
  const outPath = path.join(outDir, fileName);

  if (!fs.existsSync(path.join(petDir, spritesheet))) {
    throw new Error(`Missing spritesheet for ${id}: ${spritesheet}`);
  }

  fs.rmSync(outPath, { force: true });
  sh("zip", ["-X", "-j", outPath, "petpack.json", "pet.json", spritesheet], { cwd: stagingDir });

  index.push({
    id: manifest.id || id,
    displayName: manifest.displayName || manifest.name || id,
    description: manifest.description || "",
    version: manifest.version || "1.0.0",
    fileName
  });
}

fs.writeFileSync(path.join(outDir, "petpacks.json"), `${JSON.stringify(index, null, 2)}\n`);
fs.rmSync(stagingRoot, { recursive: true, force: true });
