const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const binaryExtensions = new Set([".dmg", ".exe", ".ico", ".petpack", ".png", ".webp", ".zip"]);
const nonEnglish = /[\u0400-\u04ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const failures = [];

for (const relative of files) {
  if (binaryExtensions.has(path.extname(relative).toLowerCase())) {
    continue;
  }
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    continue;
  }
  const content = fs.readFileSync(absolute, "utf8");
  const matches = content.match(nonEnglish);
  if (matches?.length) {
    failures.push({ file: relative, samples: [...new Set(matches)].slice(0, 8) });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, reason: "tracked text is not English-only", failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: files.length }, null, 2));
