const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REQUIRED_FILES = ["pet.json"];

function uniqueExistingDirs(dirs) {
  const seen = new Set();
  const result = [];
  for (const dir of dirs.filter(Boolean)) {
    const resolved = path.resolve(dir);
    if (seen.has(resolved) || !fs.existsSync(resolved)) {
      continue;
    }
    const stat = fs.statSync(resolved, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) {
      continue;
    }
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}

function defaultPetRoots({ app, packagedResourcesDir, bundledPetsDir } = {}) {
  const roots = [];
  if (process.env.CODEX_PETS_DIR) {
    roots.push(...process.env.CODEX_PETS_DIR.split(path.delimiter));
  }
  if (bundledPetsDir) {
    roots.push(bundledPetsDir);
  }
  if (packagedResourcesDir) {
    roots.push(path.join(packagedResourcesDir, "pets"));
  }
  if (app) {
    roots.push(path.join(app.getPath("userData"), "pets"));
  }
  roots.push(path.join(os.homedir(), ".codex", "pets"));
  return uniqueExistingDirs(roots);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findPetPackages(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => REQUIRED_FILES.every((file) => fs.existsSync(path.join(dir, file))));
}

function normalizePetPackage(dir) {
  const manifestPath = path.join(dir, "pet.json");
  const manifest = readJson(manifestPath);
  const id = String(manifest.id || path.basename(dir));
  const displayName = String(manifest.displayName || manifest.name || id);
  const description = String(manifest.description || "");
  const spritesheetPath = String(manifest.spritesheetPath || "spritesheet.webp");
  const resolvedSpritesheet = path.resolve(dir, spritesheetPath);

  if (!fs.existsSync(resolvedSpritesheet)) {
    throw new Error(`Missing spritesheet for ${id}: ${resolvedSpritesheet}`);
  }

  return {
    id,
    displayName,
    description,
    manifestPath,
    root: dir,
    spritesheetPath: resolvedSpritesheet,
    spritesheetUrl: pathToFileURL(resolvedSpritesheet).toString()
  };
}

function listPets(roots) {
  const byId = new Map();
  const errors = [];

  for (const root of roots) {
    let packages = [];
    try {
      packages = findPetPackages(root);
    } catch (error) {
      errors.push({ root, error: error.message });
      continue;
    }

    for (const packageDir of packages) {
      try {
        const pet = normalizePetPackage(packageDir);
        if (!byId.has(pet.id)) {
          byId.set(pet.id, pet);
        }
      } catch (error) {
        errors.push({ root: packageDir, error: error.message });
      }
    }
  }

  return {
    pets: [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    errors
  };
}

module.exports = {
  defaultPetRoots,
  listPets
};
