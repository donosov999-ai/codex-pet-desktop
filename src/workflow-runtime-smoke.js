const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPaths = [
  ".github/workflows/release.yml",
  ".github/workflows/pages.yml"
];

function hasNode24RuntimeOptIn(source) {
  return /^env:\n(?:[ \t]+[A-Z0-9_]+:.*\n)*[ \t]+FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:[ \t]*(true|"true"|'true')[ \t]*$/m.test(
    source
  );
}

const failures = workflowPaths.flatMap((workflowPath) => {
  const source = fs.readFileSync(path.join(root, workflowPath), "utf8");
  return hasNode24RuntimeOptIn(source)
    ? []
    : [`${workflowPath} must opt into Node 24 JavaScript action runtime.`];
});

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, workflowCount: workflowPaths.length }, null, 2));
