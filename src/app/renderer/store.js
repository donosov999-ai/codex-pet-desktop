import { arrayBufferToBase64, friendlyPetpackError } from "./petpack.js";
import { compareVersions } from "./version.js";

function resolvePetpackAssetUrl(indexUrl, fileName) {
  if (!indexUrl || !fileName) {
    return "";
  }
  return new URL(fileName, indexUrl).href;
}

function localPetFor(remote, localPets) {
  return (localPets || []).find((pet) => pet.id === remote?.id);
}

function actionLabel(remote, local) {
  if (!local) {
    return "安装";
  }
  if (remote.version && compareVersions(remote.version, local.version) > 0) {
    return "更新";
  }
  return "重新安装";
}

function remoteVersionLabel(remote) {
  return remote?.version ? `v${remote.version}` : "未标版本";
}

function localVersionLabel(local) {
  return local?.version ? `当前 v${local.version}` : "未安装";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
}

function storeFilter(remote, local, selectedFilter) {
  const hasUpdate = local && remote.version && compareVersions(remote.version, local.version) > 0;
  if (selectedFilter === "updates") {
    return hasUpdate;
  }
  if (selectedFilter === "installed") {
    return Boolean(local);
  }
  if (selectedFilter === "uninstalled") {
    return !local;
  }
  return true;
}

export function createStoreController({ dom, petDesktop, refreshPetList, state }) {
  let remotePetpacks = [];
  let loading = false;

  function setStoreStatus(message) {
    if (dom.petStoreStatusEl) {
      dom.petStoreStatusEl.textContent = message || "";
    }
  }

  function renderStore() {
    if (!dom.petStoreListEl) {
      return;
    }
    const visiblePetpacks = remotePetpacks.filter((remote) =>
      storeFilter(remote, localPetFor(remote, state.pets), dom.storeFilter?.value || "all")
    );
    if (!visiblePetpacks.length) {
      const empty = document.createElement("div");
      empty.className = "pet-store-empty";
      empty.textContent = loading ? "正在载入资源库..." : "当前筛选下没有宠物包。";
      dom.petStoreListEl.replaceChildren(empty);
      return;
    }

    dom.petStoreListEl.replaceChildren(
      ...visiblePetpacks.map((remote) => {
        const local = localPetFor(remote, state.pets);
        const card = document.createElement("article");
        card.className = "pet-store-card";

        const preview = document.createElement("div");
        preview.className = "pet-store-preview";
        const previewUrl = resolvePetpackAssetUrl(state.appInfo.petpackIndexUrl, remote.previewAtlas);
        if (previewUrl) {
          preview.style.backgroundImage = `url("${previewUrl}")`;
        }
        preview.setAttribute("aria-label", `${remote.displayName || remote.id} 预览`);

        const body = document.createElement("div");
        body.className = "pet-store-body";
        const title = document.createElement("div");
        title.className = "pet-store-title";
        title.textContent = remote.displayName || remote.id;
        const meta = document.createElement("div");
        meta.className = "pet-store-meta";
        meta.textContent = `${remoteVersionLabel(remote)} · ${localVersionLabel(local)}`;
        const description = document.createElement("div");
        description.className = "pet-store-description";
        description.textContent = remote.description || "暂无描述";
        const details = document.createElement("div");
        details.className = "pet-store-details";
        const parts = [formatBytes(remote.sizeBytes), remote.updatedAt].filter(Boolean);
        details.textContent = parts.join(" · ");
        body.append(title, meta, description, details);

        const install = document.createElement("button");
        install.type = "button";
        install.textContent = actionLabel(remote, local);
        install.addEventListener("click", () => {
          installFromStore(remote, install).catch((error) => setStoreStatus(friendlyPetpackError(error)));
        });

        card.append(preview, body, install);
        return card;
      })
    );
  }

  async function loadStore() {
    if (!state.appInfo.petpackIndexUrl || typeof fetch !== "function") {
      setStoreStatus("资源库不可用。");
      return;
    }
    loading = true;
    dom.refreshStoreButton.disabled = true;
    setStoreStatus("正在刷新资源库...");
    renderStore();
    try {
      const response = await fetch(state.appInfo.petpackIndexUrl, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      remotePetpacks = (await response.json()).filter((petpack) => petpack?.id && petpack?.fileName);
      setStoreStatus(`已载入 ${remotePetpacks.length} 个宠物包。`);
      renderStore();
    } catch (error) {
      setStoreStatus(`刷新资源库失败：${error.message}`);
    } finally {
      loading = false;
      dom.refreshStoreButton.disabled = false;
      renderStore();
    }
  }

  async function installFromStore(remote, button) {
    const url = resolvePetpackAssetUrl(state.appInfo.petpackIndexUrl, remote.fileName);
    if (!url) {
      throw new Error("资源包下载地址缺失。");
    }
    button.disabled = true;
    const local = localPetFor(remote, state.pets);
    const action = actionLabel(remote, local);
    setStoreStatus(`正在${action} ${remote.displayName || remote.id}...`);
    try {
      try {
        const response = await fetch(url, { headers: { Accept: "application/octet-stream" } });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = arrayBufferToBase64(await response.arrayBuffer());
        const preview = await petDesktop.inspectPetpack(data);
        if (preview.id !== remote.id) {
          throw new Error(`资源索引和宠物包 id 不一致：${remote.id} / ${preview.id}`);
        }
        const result = await petDesktop.importPetpack(data);
        refreshPetList(result.pets, result.importedPetId);
        renderStore();
        const done = action === "重新安装" ? "已重新安装" : result.replaced ? "已更新" : "已安装";
        setStoreStatus(`${done} ${result.displayName || result.importedPetId}。`);
      } catch (error) {
        setStoreStatus(`${action}失败：${friendlyPetpackError(error)}。可以打开下载页手动下载。`);
      }
    } finally {
      button.disabled = false;
    }
  }

  function openStore() {
    dom.petStoreEl?.scrollIntoView?.({ block: "start" });
    return loadStore();
  }

  function bind() {
    dom.refreshStoreButton?.addEventListener("click", () => {
      loadStore();
    });
    dom.storeFilter?.addEventListener("change", renderStore);
  }

  return {
    bind,
    loadStore,
    openStore,
    renderStore
  };
}
