const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
const generatedConfigPath = path.join(root, "src-tauri", "tauri.generated.conf.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCargoPackageVersion(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  let inPackageSection = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*\[package\]\s*$/.test(line)) {
      inPackageSection = true;
      continue;
    }
    if (inPackageSection && /^\s*\[/.test(line)) {
      break;
    }
    if (inPackageSection) {
      const version = line.match(/^\s*version\s*=\s*"([^"]+)"\s*$/)?.[1];
      if (version) {
        return version;
      }
    }
  }
  throw new Error(`Unable to read package.version from ${path.relative(root, filePath)}`);
}

const expectedVersion = readJson(packageJsonPath).version;
const tauriVersion = readJson(tauriConfigPath).version;
const cargoVersion = readCargoPackageVersion(cargoTomlPath);

const mismatches = [
  ["src-tauri/tauri.conf.json", tauriVersion],
  ["src-tauri/Cargo.toml", cargoVersion]
].filter(([, version]) => version !== expectedVersion);

if (mismatches.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "source versions differ",
        expected: expectedVersion,
        mismatches
      },
      null,
      2
    )
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, ["scripts/build-app.js", "prepare", "windows"], {
  cwd: root,
  encoding: "utf8"
});

if (result.status !== 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "build-app prepare failed",
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr
      },
      null,
      2
    )
  );
  process.exit(1);
}

const generatedVersion = readJson(generatedConfigPath).version;

if (generatedVersion !== expectedVersion) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "generated installer config version differs from package version",
        expected: expectedVersion,
        actual: generatedVersion
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, version: expectedVersion }, null, 2));
