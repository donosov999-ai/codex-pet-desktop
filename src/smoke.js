const path = require("node:path");
const { validatePetResources } = require("../scripts/qa-petpack-assets");

const projectRoot = path.resolve(__dirname, "..");
const roots = [path.join(projectRoot, "resources", "pets")];
const report = validatePetResources(roots[0]);
const bundledPets = new Map(report.pets.map((pet) => [pet.id, pet]));
// Packs that must ship. This used to list four native skins; they were dropped from the deck
// on 2026-08-06. Replaced with our anchors: biruzik is the flagship with the care block, grovi
// and asibots run on live customer sites. The list is deliberately SHORT — it catches "the
// bundle fell apart", it does not describe the whole deck, otherwise every new mascot would
// require editing this test.
const requiredPets = ["biruzik", "grovi", "asibots"];
const requiredDisplayNames = {
  "biruzik": "Biruzik",
  "grovi": "Grovi",
  "asibots": "ASI Robot"
};
const missingPets = requiredPets.filter((id) => !bundledPets.has(id));

if (missingPets.length > 0) {
  console.error(JSON.stringify({ ok: false, roots, missingPets, report }, null, 2));
  process.exit(1);
}

const displayNameErrors = requiredPets
  .filter((id) => bundledPets.get(id).displayName !== requiredDisplayNames[id])
  .map((id) => ({ id, actual: bundledPets.get(id).displayName, expected: requiredDisplayNames[id] }));
if (displayNameErrors.length > 0) {
  console.error(JSON.stringify({ ok: false, displayNameErrors }, null, 2));
  process.exit(1);
}

if (!report.ok) {
  console.error(JSON.stringify({ ok: false, report }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      roots,
      petCount: report.pets.length,
      pets: requiredPets.map((id) => {
        const pet = bundledPets.get(id);
        return {
          id: pet.id,
          displayName: pet.displayName,
          spritesheet: pet.spritesheet
        };
      }),
      expected: report.expected,
      errors: report.errors
    },
    null,
    2
  )
);
