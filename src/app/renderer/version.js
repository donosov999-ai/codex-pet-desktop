export function cleanVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[+-]/)[0];
}

export function versionParts(value) {
  return cleanVersion(value)
    .split(".")
    .slice(0, 3)
    .map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
}

export function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function isRemoteCompatible(remote, appVersion) {
  return !appVersion || !remote?.minAppVersion || compareVersions(appVersion, remote.minAppVersion) >= 0;
}

export function summarizePetpackUpdates(localPets, remotePetpacks, appVersion = "") {
  const localById = new Map((localPets || []).map((pet) => [pet.id, pet]));
  const upgrades = [];
  const incompatibleUpgrades = [];
  const missing = [];

  for (const remote of remotePetpacks || []) {
    if (!remote?.id) {
      continue;
    }
    const local = localById.get(remote.id);
    if (!local) {
      missing.push(remote);
      continue;
    }
    if (remote.version && compareVersions(remote.version, local.version) > 0) {
      if (isRemoteCompatible(remote, appVersion)) {
        upgrades.push({ local, remote });
      } else {
        incompatibleUpgrades.push({ local, remote });
      }
    }
  }

  if (upgrades.length) {
    const first = upgrades[0];
    const name = first.remote.displayName || first.remote.id;
    const more = upgrades.length > 1 ? `; ${upgrades.length - 1} more updates are available` : "";
    return {
      kind: "upgrade",
      message: `${name} v${first.remote.version} is available; current v${
        first.local.version || "unknown"
      }${more}. Update it directly from the pet catalog.`
    };
  }

  if (incompatibleUpgrades.length) {
    const first = incompatibleUpgrades[0];
    const name = first.remote.displayName || first.remote.id;
    const more = incompatibleUpgrades.length > 1 ? `; ${incompatibleUpgrades.length - 1} more packs also require a newer app` : "";
    return {
      kind: "app-upgrade-required",
      message: `${name} v${first.remote.version} is available, but first update the app to v${
        first.remote.minAppVersion || "a newer version"
      }${more}.`
    };
  }

  if (missing.length) {
    return {
      kind: "missing",
      message: `The catalog contains ${missing.length} uninstalled pets.`
    };
  }

  return {
    kind: "current",
    message: "Pet resources already match the downloads page."
  };
}
