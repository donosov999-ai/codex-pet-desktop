import { cleanVersion, compareVersions, summarizePetpackUpdates } from "./version.js";

export function createUpdateController({ dom, petDesktop, setUpdateStatus, state }) {
  async function checkForUpdates() {
    if (!state.appInfo.latestReleaseApi || typeof fetch !== "function") {
      setUpdateStatus("检查更新不可用。");
      return;
    }
    dom.checkUpdateButton.disabled = true;
    setUpdateStatus("正在检查主程序更新...");
    try {
      const response = await fetch(state.appInfo.latestReleaseApi, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const latest = await response.json();
      const latestTag = latest.tag_name || latest.name || "";
      if (!latestTag) {
        throw new Error("latest release tag is missing");
      }
      if (compareVersions(latestTag, state.appInfo.version) > 0) {
        setUpdateStatus(`发现主程序新版本 ${latestTag}，点击 Open Downloads 下载。`);
        return;
      }
      setUpdateStatus(`主程序已是最新版本 v${cleanVersion(state.appInfo.version)}。`);
    } catch (error) {
      setUpdateStatus(`检查主程序更新失败：${error.message}`);
    } finally {
      dom.checkUpdateButton.disabled = false;
    }
  }

  async function checkPetpackUpdates() {
    if (!state.appInfo.petpackIndexUrl || typeof fetch !== "function") {
      setUpdateStatus("宠物资源更新检查不可用。");
      return;
    }
    dom.checkPetpackUpdatesButton.disabled = true;
    setUpdateStatus("正在检查宠物资源更新...");
    try {
      const response = await fetch(state.appInfo.petpackIndexUrl, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const remotePetpacks = await response.json();
      setUpdateStatus(summarizePetpackUpdates(state.pets, remotePetpacks).message);
    } catch (error) {
      setUpdateStatus(`检查宠物资源更新失败：${error.message}`);
    } finally {
      dom.checkPetpackUpdatesButton.disabled = false;
    }
  }

  function bind() {
    dom.checkUpdateButton?.addEventListener("click", () => {
      checkForUpdates();
    });
    dom.checkPetpackUpdatesButton?.addEventListener("click", () => {
      checkPetpackUpdates();
    });
    dom.openDownloadsButton?.addEventListener("click", () => {
      petDesktop
        ?.openDownloads?.()
        .then(() => setUpdateStatus("已打开下载页。"))
        .catch((error) => setUpdateStatus(`打开下载页失败：${error.message}`));
    });
  }

  return {
    bind,
    checkForUpdates,
    checkPetpackUpdates
  };
}
