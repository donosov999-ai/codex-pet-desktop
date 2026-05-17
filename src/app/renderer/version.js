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
    const more = upgrades.length > 1 ? `，另有 ${upgrades.length - 1} 个资源可更新` : "";
    return {
      kind: "upgrade",
      message: `${name}有新资源 v${first.remote.version}，当前 v${
        first.local.version || "未知"
      }${more}。可以在宠物资源库里直接更新。`
    };
  }

  if (incompatibleUpgrades.length) {
    const first = incompatibleUpgrades[0];
    const name = first.remote.displayName || first.remote.id;
    const more = incompatibleUpgrades.length > 1 ? `，另有 ${incompatibleUpgrades.length - 1} 个资源也需要新版主程序` : "";
    return {
      kind: "app-upgrade-required",
      message: `${name}有新资源 v${first.remote.version}，但需要先升级主程序到 v${
        first.remote.minAppVersion || "更高版本"
      }${more}。`
    };
  }

  if (missing.length) {
    return {
      kind: "missing",
      message: `资源库有 ${missing.length} 个未安装宠物。`
    };
  }

  return {
    kind: "current",
    message: "宠物资源已是当前下载页版本。"
  };
}
