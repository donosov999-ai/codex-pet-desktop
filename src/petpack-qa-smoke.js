const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isRootFileName, parseWebpSize, validatePetResources } = require("../scripts/qa-petpack-assets");

function makeVp8xWebp(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

const size = parseWebpSize(makeVp8xWebp(1536, 1872));
if (size.width !== 1536 || size.height !== 1872) {
  console.error(JSON.stringify({ ok: false, reason: "VP8X parser returned wrong size", size }));
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const report = validatePetResources(path.join(projectRoot, "resources", "pets"));
if (!report.ok || report.pets.length === 0) {
  console.error(JSON.stringify({ ok: false, reason: "pet resource QA failed", report }, null, 2));
  process.exit(1);
}

const metadataFailures = report.pets.flatMap((pet) => {
  const failures = [];
  for (const field of ["author", "license", "minAppVersion"]) {
    if (!pet[field]) {
      failures.push(`${pet.id} missing ${field}`);
    }
  }
  if (!Array.isArray(pet.tags) || pet.tags.length === 0) {
    failures.push(`${pet.id} missing tags`);
  }
  if (!Array.isArray(pet.changelog) || pet.changelog.length === 0) {
    failures.push(`${pet.id} missing changelog`);
  }
  return failures;
});
if (metadataFailures.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: "pet metadata QA failed", metadataFailures, report }, null, 2));
  process.exit(1);
}

const invalidNames = ["../spritesheet.webp", "nested/spritesheet.webp", "nested\\spritesheet.webp", "sprite..webp"];
const acceptedInvalid = invalidNames.filter(isRootFileName);
if (acceptedInvalid.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: "unsafe spritesheetPath accepted", acceptedInvalid }, null, 2));
  process.exit(1);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "petpack-qa-"));
try {
  const badIdDir = path.join(tempRoot, "bad-id");
  fs.mkdirSync(badIdDir);
  fs.writeFileSync(
    path.join(badIdDir, "pet.json"),
    JSON.stringify({ id: "other-id", displayName: "Bad", spritesheetPath: "spritesheet.webp" })
  );
  fs.writeFileSync(path.join(badIdDir, "spritesheet.webp"), makeVp8xWebp(1536, 1872));

  const badPathDir = path.join(tempRoot, "bad-path");
  fs.mkdirSync(badPathDir);
  fs.writeFileSync(
    path.join(badPathDir, "pet.json"),
    JSON.stringify({ id: "bad-path", displayName: "Bad Path", spritesheetPath: "../spritesheet.webp" })
  );

  const badMetadataDir = path.join(tempRoot, "bad-metadata");
  fs.mkdirSync(badMetadataDir);
  fs.writeFileSync(
    path.join(badMetadataDir, "pet.json"),
    JSON.stringify({
      id: "bad-metadata",
      displayName: "Bad Metadata",
      spritesheetPath: "spritesheet.webp",
      author: "",
      license: "",
      minAppVersion: "dev",
      tags: "cat",
      changelog: "changed"
    })
  );
  fs.writeFileSync(path.join(badMetadataDir, "spritesheet.webp"), makeVp8xWebp(1536, 1872));

  const badV2Dir = path.join(tempRoot, "bad-v2");
  fs.mkdirSync(badV2Dir);
  fs.writeFileSync(
    path.join(badV2Dir, "pet.json"),
    JSON.stringify({
      id: "bad-v2",
      displayName: "Bad V2",
      spritesheetPath: "spritesheet.webp",
      spriteVersionNumber: 2,
      author: "Test",
      license: "MIT",
      minAppVersion: "0.2.32",
      tags: ["test"],
      changelog: ["test"]
    })
  );
  fs.writeFileSync(path.join(badV2Dir, "spritesheet.webp"), makeVp8xWebp(1536, 1872));

  const badCareDir = path.join(tempRoot, "bad-care");
  fs.mkdirSync(badCareDir);
  fs.writeFileSync(
    path.join(badCareDir, "pet.json"),
    JSON.stringify({
      id: "bad-care",
      displayName: "Bad Care",
      spritesheetPath: "spritesheet.webp",
      author: "Test",
      license: "MIT",
      minAppVersion: "0.2.30",
      tags: ["test"],
      changelog: ["test"],
      care: {
        spritesheetPath: "care-spritesheet.webp",
        atlas: { width: 1536, height: 208, columns: 8, rows: 1, cellWidth: 192, cellHeight: 208 },
        states: {
          play: {
            row: 0,
            frames: 6,
            fps: 5,
            loops: 0,
            durationMs: 500,
            timeline: [{ frames: [0, 6], frameDurationMs: 10, repeat: 0 }]
          }
        }
      }
    })
  );
  fs.writeFileSync(path.join(badCareDir, "spritesheet.webp"), makeVp8xWebp(1536, 1872));
  fs.writeFileSync(path.join(badCareDir, "care-spritesheet.webp"), makeVp8xWebp(1536, 208));

  const negativeReport = validatePetResources(tempRoot);
  const negativeErrors = negativeReport.errors.flatMap((entry) => entry.errors);
  const requiredErrors = [
    "pet.json id must match directory name",
    "spritesheetPath must be a root-level file name",
    "author is required",
    "license is required",
    "minAppVersion must be x.y.z",
    "tags must be an array",
    "changelog must be an array",
    "spriteVersionNumber 2 requires 11 rows",
    "Invalid care loop count",
    "Invalid care duration",
    "Invalid care timeline frames",
    "Invalid care timeline frame duration",
    "Invalid care timeline repeat"
  ];
  const missingErrors = requiredErrors.filter((text) => !negativeErrors.some((error) => error.includes(text)));
  if (negativeReport.ok || missingErrors.length > 0) {
    console.error(JSON.stringify({ ok: false, reason: "negative QA checks failed", missingErrors, negativeReport }, null, 2));
    process.exit(1);
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, petCount: report.pets.length }, null, 2));
