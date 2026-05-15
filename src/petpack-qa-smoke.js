const path = require("node:path");
const { parseWebpSize, validatePetResources } = require("../scripts/qa-petpack-assets");

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
if (!report.ok || report.pets.length !== 3) {
  console.error(JSON.stringify({ ok: false, reason: "pet resource QA failed", report }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, petCount: report.pets.length }, null, 2));
