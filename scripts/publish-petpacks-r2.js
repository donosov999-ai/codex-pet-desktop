#!/usr/bin/env node
// Publish built .petpack files to the shared R2 channel (mascot.asibots.pro) under /desktop/.
//
// WHY. Pet packs used to be bundled into the binary, so shipping new art meant cutting a release
// and asking every user to reinstall. The web engine has not had that problem for months: it
// pulls packs from the channel at runtime. This puts the desktop app on the same channel.
//
// The path is deliberately SEPARATE from the web tree (/desktop/ next to /channels/ and /packs/):
// the two runtimes use different pack formats — the web reads loose files, the desktop reads a
// .petpack zip with an atlas — and merging the formats is a much larger job that we are not doing
// here. One channel, one domain, two shelves.
//
// Usage:
//   node scripts/build-petpacks.js && node scripts/publish-petpacks-r2.js
//   node scripts/publish-petpacks-r2.js --dry-run
//
// The rclone remote is the same one the web publisher uses (r2mascot:mascot), so a machine that
// can publish the web channel can publish this too, with no extra credentials.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "release", "petpacks");
const remote = `${process.env.MASCOT_R2_REMOTE || "r2mascot:mascot"}/desktop`;
const dryRun = process.argv.includes("--dry-run");

if (!fs.existsSync(path.join(outDir, "petpacks.json"))) {
  console.error(`No index at ${outDir}/petpacks.json — run "node scripts/build-petpacks.js" first.`);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(path.join(outDir, "petpacks.json"), "utf8"));
const packs = Array.isArray(index) ? index : index.petpacks || [];
const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".petpack"));
if (packs.length !== files.length) {
  console.error(`Index lists ${packs.length} packs but ${files.length} .petpack files exist — refusing to publish a half-built shelf.`);
  process.exit(1);
}

const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`Publishing ${files.length} packs (${(bytes / 1048576).toFixed(0)} MB) to ${remote}`);

const args = [
  "sync", outDir, remote,
  "--checksum",
  // Packs are addressed by id+version, so a published file never changes under the same name.
  // A long cache is safe and keeps the store snappy; the index below is what must stay fresh.
  "--header-upload", "Cache-Control: public, max-age=86400",
  "--exclude", ".petpack-staging/**",
  "--progress",
];
if (dryRun) args.push("--dry-run");

const sync = spawnSync("rclone", args, { stdio: "inherit" });
if (sync.status !== 0) {
  console.error("rclone sync failed — nothing was published.");
  process.exit(sync.status || 1);
}

if (!dryRun) {
  // The index decides what the store shows, so it must never be served stale. Re-upload it on its
  // own with a short cache, AFTER the packs are in place: an index that lists a pack the shelf
  // does not have yet is worse than an index that is a few minutes old.
  const fresh = spawnSync("rclone", [
    "copy", path.join(outDir, "petpacks.json"), remote,
    "--header-upload", "Cache-Control: public, max-age=300",
  ], { stdio: "inherit" });
  if (fresh.status !== 0) {
    console.error("Packs are published but the index upload failed — the store will not see them.");
    process.exit(fresh.status || 1);
  }
  console.log("Published. Check: curl -s -o /dev/null -w '%{http_code}\\n' https://mascot.asibots.pro/desktop/petpacks.json");
}
