#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const target = process.argv[2] || "build";
const platform = process.argv[3] || process.env.PET_DESKTOP_PLATFORM || process.platform;

function bundleTargetsForPlatform(value) {
  if (value === "windows" || value === "win32") {
    return ["nsis"];
  }
  if (value === "macos" || value === "macos-arm64" || value === "macos-x64" || value === "darwin") {
    return ["dmg"];
  }
  return process.platform === "darwin" ? ["dmg"] : ["nsis"];
}

function buildTargetForPlatform(value) {
  if (value === "macos-arm64") {
    return "aarch64-apple-darwin";
  }
  if (value === "macos-x64") {
    return "x86_64-apple-darwin";
  }
  return null;
}

function releaseBundleDirForTarget(tauriRoot, buildTarget) {
  if (buildTarget) {
    return path.join(tauriRoot, "target", buildTarget, "release", "bundle");
  }
  return path.join(tauriRoot, "target", "release", "bundle");
}

const root = path.resolve(__dirname, "..");
const tauriDir = path.join(root, "src-tauri");
const packageJsonPath = path.join(root, "package.json");
const tauriConfigPath = path.join(tauriDir, "tauri.conf.json");
const cargoTomlPath = path.join(tauriDir, "Cargo.toml");
const configPath = path.join(tauriDir, "tauri.generated.conf.json");
const buildTarget = buildTargetForPlatform(platform);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function localTauriCliEntrypoint() {
  const packageJsonPath = require.resolve("@tauri-apps/cli/package.json", { paths: [root] });
  const cliPackageJson = readJson(packageJsonPath);
  const binPath = cliPackageJson.bin?.tauri || "tauri.js";
  return path.join(path.dirname(packageJsonPath), binPath);
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

const packageJson = readJson(packageJsonPath);
const baseConfig = readJson(tauriConfigPath);
const cargoVersion = readCargoPackageVersion(cargoTomlPath);
const versionMismatches = [
  ["src-tauri/tauri.conf.json", baseConfig.version],
  ["src-tauri/Cargo.toml", cargoVersion]
].filter(([, version]) => version !== packageJson.version);

if (versionMismatches.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "app version mismatch",
        expected: packageJson.version,
        mismatches: versionMismatches
      },
      null,
      2
    )
  );
  process.exit(1);
}

const config = {
  ...baseConfig,
  version: packageJson.version,
  bundle: {
    ...(baseConfig.bundle || {}),
    active: true,
    targets: bundleTargetsForPlatform(platform),
    resources: baseConfig.bundle?.resources || {}
  }
};

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

if (target === "prepare") {
  process.exit(0);
}

if (target === "build") {
  fs.rmSync(releaseBundleDirForTarget(tauriDir, buildTarget), { recursive: true, force: true });
}

const command =
  target === "dev"
    ? {
        executable: "cargo",
        args: ["run"],
        cwd: tauriDir
      }
    : {
        executable: process.execPath,
        args: [
          localTauriCliEntrypoint(),
          "build",
          "--config",
          configPath,
          ...(buildTarget ? ["--target", buildTarget] : [])
        ],
        cwd: root
      };

const result = spawnSync(command.executable, command.args, {
  cwd: command.cwd,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
