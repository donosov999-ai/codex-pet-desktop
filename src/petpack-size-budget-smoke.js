#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const petpacksDir = path.join(root, "release", "petpacks");
const indexPath = path.join(petpacksDir, "petpacks.json");
const MAX_PETPACK_SIZE_BYTES = 5 * 1024 * 1024;

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  fail("petpack index must be generated before size budget smoke", { indexPath });
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
if (!Array.isArray(index) || index.length === 0) {
  fail("petpack index must contain generated petpacks", { indexPath });
}

const failures = [];
let maxSizeBytes = 0;

for (const entry of index) {
  const fileName = String(entry.fileName || "");
  const petpackPath = path.join(petpacksDir, fileName);
  if (!fileName.endsWith(".petpack") || fileName.includes("/") || fileName.includes("\\")) {
    failures.push(`${entry.id || fileName || "unknown"} has unsafe petpack fileName`);
    continue;
  }
  if (!fs.existsSync(petpackPath)) {
    failures.push(`${entry.id || fileName} references missing petpack ${fileName}`);
    continue;
  }

  const sizeBytes = fs.statSync(petpackPath).size;
  maxSizeBytes = Math.max(maxSizeBytes, sizeBytes);
  if (entry.sizeBytes !== sizeBytes) {
    failures.push(`${entry.id || fileName} index sizeBytes ${entry.sizeBytes} does not match ${sizeBytes}`);
  }
  if (sizeBytes > MAX_PETPACK_SIZE_BYTES) {
    failures.push(`${entry.id || fileName} is ${sizeBytes} bytes; budget is ${MAX_PETPACK_SIZE_BYTES}`);
  }
}

if (failures.length) {
  fail("petpack size budget failed", { maxSizeBytes, maxBudgetBytes: MAX_PETPACK_SIZE_BYTES, failures });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      petCount: index.length,
      maxSizeBytes,
      maxBudgetBytes: MAX_PETPACK_SIZE_BYTES
    },
    null,
    2
  )
);
