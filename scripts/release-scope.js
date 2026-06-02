#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

function gitChangedFiles(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function changedFilesFromGit() {
  return unique([
    ...gitChangedFiles(["diff", "--name-only"]),
    ...gitChangedFiles(["diff", "--cached", "--name-only"]),
    ...gitChangedFiles(["ls-files", "--others", "--exclude-standard"])
  ]);
}

function normalizedPath(filePath) {
  return String(filePath || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function isReadmeOnlyPath(filePath) {
  return filePath === "README.md";
}

function isPagesPath(filePath) {
  return (
    filePath.startsWith("docs/") ||
    filePath.startsWith("resources/pets/") ||
    [
      ".github/workflows/pages.yml",
      "scripts/build-petpacks.js",
      "scripts/format-pet-json.js",
      "scripts/petpack-zip.js",
      "scripts/qa-petpack-assets.js",
      "scripts/render-visual-qa-page.js",
      "scripts/render-download-page.js",
      "src/download-page-smoke.js",
      "src/visual-qa-page-smoke.js"
    ].includes(filePath)
  );
}

function isAppReleasePath(filePath) {
  return (
    filePath.startsWith("src-tauri/") ||
    filePath.startsWith("src/app/") ||
    (filePath.startsWith("src/") && /-smoke\.(js|mjs)$/.test(filePath) && !isPagesPath(filePath)) ||
    [
      ".github/workflows/release.yml",
      "package.json",
      "package-lock.json",
      "scripts/build-app.js",
      "scripts/check-release-tag.js",
      "scripts/release-scope.js",
      "scripts/run-smoke.js",
      "scripts/run-check.js",
      "src/build-app-config-smoke.js",
      "src/release-tag-smoke.js",
      "src/release-scope-smoke.js",
      "src/smoke-runner-smoke.js",
      "src/workflow-runtime-smoke.js"
    ].includes(filePath)
  );
}

function classifyReleaseScope(inputFiles) {
  const files = unique(inputFiles.map(normalizedPath).filter(Boolean));
  const appFiles = files.filter(isAppReleasePath);
  const pagesFiles = files.filter((file) => !isAppReleasePath(file) && isPagesPath(file));
  const readmeFiles = files.filter(isReadmeOnlyPath);
  const knownFiles = new Set([...appFiles, ...pagesFiles, ...readmeFiles]);
  const unknownFiles = files.filter((file) => !knownFiles.has(file));

  if (!files.length) {
    return {
      scope: "none",
      appReleaseRequired: false,
      tagRequired: false,
      pagesDeployLikely: false,
      files
    };
  }

  if (appFiles.length) {
    return {
      scope: "app-release-required",
      appReleaseRequired: true,
      tagRequired: true,
      pagesDeployLikely: false,
      files,
      appFiles,
      pagesFiles,
      unknownFiles
    };
  }

  if (pagesFiles.length && !unknownFiles.length) {
    return {
      scope: "petpack-pages",
      appReleaseRequired: false,
      tagRequired: false,
      pagesDeployLikely: true,
      files,
      pagesFiles
    };
  }

  if (readmeFiles.length === files.length) {
    return {
      scope: "docs-only",
      appReleaseRequired: false,
      tagRequired: false,
      pagesDeployLikely: false,
      files
    };
  }

  return {
    scope: "manual-review",
    appReleaseRequired: false,
    tagRequired: false,
    pagesDeployLikely: false,
    files,
    unknownFiles
  };
}

if (require.main === module) {
  const files = process.argv.slice(2);
  const result = classifyReleaseScope(files.length ? files : changedFilesFromGit());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  classifyReleaseScope
};
