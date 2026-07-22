import { cleanVersion, compareVersions, summarizePetpackUpdates } from "./version.js";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  const kb = bytes / 1024;
  return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
}

function setProgress(progressEl, { visible = false, received = 0, total = 0 } = {}) {
  if (!progressEl) {
    return;
  }
  progressEl.classList.toggle("hidden", !visible);
  if (!visible) {
    progressEl.max = 1;
    progressEl.value = 0;
    progressEl.removeAttribute?.("aria-valuetext");
    return;
  }
  if (total > 0) {
    progressEl.max = total;
    progressEl.value = Math.min(received, total);
    progressEl.removeAttribute?.("aria-valuetext");
    return;
  }
  progressEl.removeAttribute?.("max");
  progressEl.removeAttribute?.("value");
  progressEl.setAttribute?.("aria-valuetext", received > 0 ? `Downloaded ${formatBytes(received)}` : "Downloading");
}

function errorMessage(error) {
  if (error?.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error === undefined || error === null) {
    return "Unknown error";
  }
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function assetScore(asset, platform = "") {
  const name = String(asset?.name || "").toLowerCase();
  if (!asset?.browser_download_url || !name) {
    return -1;
  }
  if (/windows|win32|win64|win/i.test(platform)) {
    return name.endsWith(".exe") && name.includes("windows") ? 3 : name.endsWith(".exe") ? 2 : -1;
  }
  if (/mac|darwin|osx/i.test(platform)) {
    return name.endsWith(".dmg") && name.includes("macos") ? 3 : name.endsWith(".dmg") ? 2 : -1;
  }
  if (name.endsWith(".exe") || name.endsWith(".dmg")) {
    return 1;
  }
  return -1;
}

function findInstallerAsset(release, platform) {
  return (release?.assets || [])
    .filter((asset) => assetScore(asset, platform) >= 0)
    .sort((left, right) => assetScore(right, platform) - assetScore(left, platform))[0];
}

export function createUpdateController({ dom, listenAppUpdateDownloadProgress = () => Promise.resolve(() => {}), petDesktop, setUpdateStatus, state }) {
  let activeAppUpdateFileName = "";

  function setDownloadStatus({ received = 0, total = 0 } = {}) {
    const current = formatBytes(received);
    const maximum = formatBytes(total);
    const progressText = current && maximum ? `: ${current} / ${maximum}` : current ? `: downloaded ${current}` : "";
    setUpdateStatus(`Downloading the app installer${progressText}. The installer will open automatically when the download finishes.`);
  }

  function applyAppUpdateDownloadProgress(progress = {}) {
    if (!activeAppUpdateFileName || progress.fileName !== activeAppUpdateFileName) {
      return;
    }
    const received = Number(progress.received) || 0;
    const total = Number(progress.total) || 0;
    setProgress(dom.appUpdateProgressEl, { visible: true, received, total });
    setDownloadStatus({ received, total });
  }

  async function fetchLatestRelease() {
    const response = await fetch(state.appInfo.latestReleaseApi, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const latest = await response.json();
    const latestTag = latest.tag_name || latest.name || "";
    if (!latestTag) {
      throw new Error("Latest version number is missing");
    }
    return { latest, latestTag };
  }

  async function checkForUpdates() {
    if (!state.appInfo.latestReleaseApi || typeof fetch !== "function") {
      setUpdateStatus("Update checking is unavailable.");
      return;
    }
    dom.checkUpdateButton.disabled = true;
    setUpdateStatus("Checking for app updates...");
    try {
      let release;
      try {
        release = await fetchLatestRelease();
      } catch (error) {
        setUpdateStatus(`Failed to check the app version: ${errorMessage(error)}`);
        return;
      }
      const { latest, latestTag } = release;
      if (compareVersions(latestTag, state.appInfo.version) > 0) {
        const notes = String(latest.body || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join("; ");
        const noteText = notes ? `Changes: ${notes}. ` : "";
        const asset = findInstallerAsset(latest, state.appInfo.platform);
        if (!asset || !petDesktop?.downloadAndInstallAppUpdate) {
          setUpdateStatus(
            `A new app version is available: current v${cleanVersion(state.appInfo.version)}, latest ${latestTag}. ${noteText}No auto-installable asset was found; use Open downloads instead.`
          );
          return;
        }
        activeAppUpdateFileName = asset.name;
        setProgress(dom.appUpdateProgressEl, { visible: true, received: 0, total: Number(asset.size) || 0 });
        setUpdateStatus(`A new app version is available: current v${cleanVersion(state.appInfo.version)}, latest ${latestTag}. ${noteText}`);
        setDownloadStatus({ received: 0, total: Number(asset.size) || 0 });
        try {
          await petDesktop.downloadAndInstallAppUpdate(asset.browser_download_url, asset.name);
        } catch (error) {
          setUpdateStatus(`Failed to download or launch the app installer: ${errorMessage(error)}. Use Open downloads to install it manually.`);
          return;
        }
        activeAppUpdateFileName = "";
        setUpdateStatus("The installer has started. Follow its prompts to finish the update.");
        return;
      }
      setUpdateStatus(`The app is up to date at v${cleanVersion(state.appInfo.version)}.`);
    } catch (error) {
      setUpdateStatus(`Failed to check the app version: ${errorMessage(error)}`);
    } finally {
      setProgress(dom.appUpdateProgressEl, { visible: false });
      activeAppUpdateFileName = "";
      dom.checkUpdateButton.disabled = false;
    }
  }

  async function checkPetpackUpdates() {
    if (!state.appInfo.petpackIndexUrl || typeof fetch !== "function") {
      setUpdateStatus("Pet pack update checking is unavailable.");
      return;
    }
    dom.checkPetpackUpdatesButton.disabled = true;
    setUpdateStatus("Checking for pet pack updates...");
    try {
      const response = await fetch(state.appInfo.petpackIndexUrl, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const remotePetpacks = await response.json();
      setUpdateStatus(summarizePetpackUpdates(state.pets, remotePetpacks, state.appInfo.version).message);
    } catch (error) {
      setUpdateStatus(`Failed to check pet pack updates: ${errorMessage(error)}`);
    } finally {
      dom.checkPetpackUpdatesButton.disabled = false;
    }
  }

  function bind() {
    listenAppUpdateDownloadProgress(applyAppUpdateDownloadProgress).catch(() => {});
    dom.checkUpdateButton?.addEventListener("click", () => {
      checkForUpdates();
    });
    dom.checkPetpackUpdatesButton?.addEventListener("click", () => {
      checkPetpackUpdates();
    });
    dom.openDownloadsButton?.addEventListener("click", () => {
      petDesktop
        ?.openDownloads?.()
        .then(() => setUpdateStatus("Opened the downloads page."))
        .catch((error) => setUpdateStatus(`Failed to open the downloads page: ${errorMessage(error)}`));
    });
  }

  return {
    bind,
    checkForUpdates,
    checkPetpackUpdates
  };
}
