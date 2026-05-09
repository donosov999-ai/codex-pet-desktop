const path = require("node:path");
const { defaultPetRoots, listPets } = require("./pets");
const { EDGE_VISIBILITY_PX, looseWindowLimits } = require("./windowBounds");

const projectRoot = path.resolve(__dirname, "..");
const roots = defaultPetRoots({
  bundledPetsDir: path.join(projectRoot, "resources", "pets")
});
const result = listPets(roots);
const tigris = result.pets.find((pet) => pet.id === "tigris-whippet");

if (!tigris) {
  console.error(JSON.stringify({ ok: false, roots, result }, null, 2));
  process.exit(1);
}

const movementLimits = looseWindowLimits(
  { width: 320, height: 340 },
  { x: 0, y: 0, width: 1920, height: 1080 }
);
if (movementLimits.minX >= -64 || movementLimits.maxX <= 1920 - 256) {
  console.error(JSON.stringify({ ok: false, movementLimits }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      roots,
      petCount: result.pets.length,
      firstPet: {
        id: tigris.id,
        displayName: tigris.displayName,
        spritesheetPath: tigris.spritesheetPath
      },
      movement: {
        edgeVisibilityPx: EDGE_VISIBILITY_PX,
        limitsFor1920x1080: movementLimits
      },
      errors: result.errors
    },
    null,
    2
  )
);
