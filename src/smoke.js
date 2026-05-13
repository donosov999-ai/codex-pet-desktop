const path = require("node:path");
const { listPets } = require("./pets");
const { EDGE_VISIBILITY_PX, looseWindowLimits } = require("./windowBounds");

const projectRoot = path.resolve(__dirname, "..");
const roots = [path.join(projectRoot, "resources", "pets")];
const result = listPets(roots);
const bundledPets = new Map(result.pets.map((pet) => [pet.id, pet]));
const requiredPets = ["mi-fen", "mi-jiu", "tigris-whippet"];
const missingPets = requiredPets.filter((id) => !bundledPets.has(id));

if (missingPets.length > 0) {
  console.error(JSON.stringify({ ok: false, roots, missingPets, result }, null, 2));
  process.exit(1);
}

const emptyResult = listPets([]);
if (emptyResult.pets.length !== 0) {
  console.error(JSON.stringify({ ok: false, emptyResult }, null, 2));
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
      pets: requiredPets.map((id) => {
        const pet = bundledPets.get(id);
        return {
          id: pet.id,
          displayName: pet.displayName,
          spritesheetPath: pet.spritesheetPath
        };
      }),
      movement: {
        edgeVisibilityPx: EDGE_VISIBILITY_PX,
        limitsFor1920x1080: movementLimits
      },
      errors: result.errors,
      emptyPetCount: emptyResult.pets.length
    },
    null,
    2
  )
);
