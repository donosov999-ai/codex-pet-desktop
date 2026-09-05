const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const binaryExtensions = new Set([".dmg", ".exe", ".ico", ".petpack", ".png", ".webp", ".zip"]);
// LICENSE is exempt on purpose. English-only is a CODE convention: this repository is public and
// international, so comments, docs and UI text must be readable by anyone. A licence is not code —
// it is a legal instrument, and the language it is written in is the owner's decision, not a style
// rule. Our LICENSE is deliberately bilingual: the terms are argued in Russian by the rights
// holder and read worldwide in English. Forcing it English-only would trade legal clarity for
// tidiness. Nothing else gets an exemption.
const legalDocuments = new Set(["LICENSE"]);
// Vendored files are excluded for the usual reason lint tools skip vendor directories: nobody
// edits them here. `src/app/vendor/biryuzik.js` is a verbatim copy of the shared pet engine from
// the mascot-engine repository, refreshed by `cp`, and its comments belong to that project.
// Rewriting them here would make the copy differ from its source, which is exactly what a
// vendored copy must never do. Changes go upstream; this directory only receives them.
const vendorPrefix = "src/app/vendor/";
// The pose inspector's UI strings are exempt for the same kind of reason the licence is: the rule
// is about CODE and PRODUCT text. This repository is public, so comments, docs and anything a user
// of the app reads must be readable by anyone. The inspector is neither — it is the owner's private
// workbench for judging pet packs, used by one person, in that person's language. Its code,
// comments and identifiers stay English; only the labels live in this one file, named so that the
// exemption cannot quietly widen.
const debugStrings = new Set(["src/app/inspector.strings.ru.js", "src/app/inspector.html"]);
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
  if (legalDocuments.has(relative)) {
    continue;
  }
  if (relative.startsWith(vendorPrefix)) {
    continue;
  }
  if (debugStrings.has(relative)) {
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
