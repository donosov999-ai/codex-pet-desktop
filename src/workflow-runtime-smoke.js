const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPaths = [
  ".github/workflows/release.yml",
  ".github/workflows/pages.yml"
];

const minimumActionMajors = new Map([
  ["actions/cache", 5],
  ["actions/checkout", 6],
  ["actions/configure-pages", 6],
  ["actions/deploy-pages", 5],
  ["actions/download-artifact", 8],
  ["actions/setup-node", 6],
  ["actions/upload-artifact", 7],
  ["actions/upload-pages-artifact", 5],
  ["softprops/action-gh-release", 3]
]);

function hasNode24RuntimeOptIn(source) {
  return /^env:\n(?:[ \t]+[A-Z0-9_]+:.*\n)*[ \t]+FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:[ \t]*(true|"true"|'true')[ \t]*$/m.test(
    source
  );
}

function actionReferenceFailures(source, workflowPath) {
  return [...source.matchAll(/^\s*-?\s*uses:\s+([^@\s]+)@(v(\d+)(?:\.\d+){0,2})\s*$/gm)].flatMap(
    ([, action, version, major]) => {
      const minimumMajor = minimumActionMajors.get(action);
      if (!minimumMajor || Number(major) >= minimumMajor) {
        return [];
      }
      return [`${workflowPath} uses ${action}@${version}; expected ${action}@v${minimumMajor} or newer.`];
    }
  );
}

const failures = workflowPaths.flatMap((workflowPath) => {
  const source = fs.readFileSync(path.join(root, workflowPath), "utf8");
  const runtimeFailures = hasNode24RuntimeOptIn(source)
    ? []
    : [`${workflowPath} must opt into Node 24 JavaScript action runtime.`];
  return [...runtimeFailures, ...actionReferenceFailures(source, workflowPath)];
});

const releaseSource = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
for (const required of [
  "quality-gate:",
  "Install Linux Tauri dependencies",
  "libwebkit2gtk-4.1-dev",
  "libappindicator3-dev",
  "npm run smoke",
  "cargo test",
  "node scripts/build-petpacks.js",
  "node src/download-page-smoke.js"
]) {
  if (!releaseSource.includes(required)) {
    failures.push(`release workflow missing quality gate step: ${required}`);
  }
}
if (releaseSource.indexOf("Install Linux Tauri dependencies") > releaseSource.indexOf("Run Rust tests")) {
  failures.push("release workflow must install Linux Tauri dependencies before running Rust tests");
}
if (!/build-windows:[\s\S]*needs:\s+quality-gate/.test(releaseSource)) {
  failures.push("build-windows must depend on quality-gate");
}
if (!/build-macos:[\s\S]*needs:\s+quality-gate/.test(releaseSource)) {
  failures.push("build-macos must depend on quality-gate");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, workflowCount: workflowPaths.length }, null, 2));
