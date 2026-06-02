const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const releaseSource = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
const buildAppSource = fs.readFileSync(path.join(root, "scripts/build-app.js"), "utf8");

const failures = [];

if (!packageJson.devDependencies?.["@tauri-apps/cli"]) {
  failures.push("package.json must install @tauri-apps/cli as a devDependency.");
}

if (!packageLock.packages?.["node_modules/@tauri-apps/cli"]) {
  failures.push("package-lock.json must lock @tauri-apps/cli.");
}

if (/cargo\s+install\s+tauri-cli/.test(releaseSource)) {
  failures.push("release workflow must not compile tauri-cli with cargo install.");
}

for (const jobName of ["build-windows", "build-macos"]) {
  const jobMatch = releaseSource.match(new RegExp(`${jobName}:[\\s\\S]*?(?=\\n  [a-z0-9-]+:|\\n  publish:|\\n$)`));
  const jobSource = jobMatch?.[0] || "";
  if (!jobSource.includes("Install JavaScript dependencies")) {
    failures.push(`${jobName} must install JavaScript dependencies before building.`);
  }
  if (jobSource.indexOf("Install JavaScript dependencies") > jobSource.indexOf("Build app")) {
    failures.push(`${jobName} must install JavaScript dependencies before Build app.`);
  }
}

if (/cargoArgs[\s\S]*"tauri"[\s\S]*"build"/.test(buildAppSource)) {
  failures.push("build-app.js must use the npm Tauri CLI instead of cargo tauri build.");
}

if (!buildAppSource.includes("@tauri-apps/cli")) {
  failures.push("build-app.js must reference the local @tauri-apps/cli package.");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, tauriCli: packageJson.devDependencies["@tauri-apps/cli"] }, null, 2));
