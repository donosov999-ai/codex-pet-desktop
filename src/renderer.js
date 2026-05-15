const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const STATES = {
  idle: { row: 0, frames: 6, fps: 5 },
  "running-right": { row: 1, frames: 8, fps: 10 },
  "running-left": { row: 2, frames: 8, fps: 10 },
  waving: { row: 3, frames: 4, fps: 6, once: true },
  jumping: { row: 4, frames: 5, fps: 8, once: true },
  failed: { row: 5, frames: 8, fps: 6, once: true },
  waiting: { row: 6, frames: 6, fps: 5 },
  running: { row: 7, frames: 6, fps: 7 },
  review: { row: 8, frames: 6, fps: 6 }
};

const petEl = document.querySelector("#pet");
const emptyStateEl = document.querySelector("#emptyState");
const panelEl = document.querySelector("#panel");
const panelBackdropEl = document.querySelector("#panelBackdrop");
const petSelect = document.querySelector("#petSelect");
const stateSelect = document.querySelector("#stateSelect");
const scaleRange = document.querySelector("#scaleRange");
const wanderToggle = document.querySelector("#wanderToggle");
const topToggle = document.querySelector("#topToggle");
const importButton = document.querySelector("#importButton");
const importEmptyButton = document.querySelector("#importEmptyButton");
const petpackInput = document.querySelector("#petpackInput");
const petManagerEl = document.querySelector("#petManager");
const petStatusEl = document.querySelector("#petStatus");
const checkUpdateButton = document.querySelector("#checkUpdateButton");
const openDownloadsButton = document.querySelector("#openDownloadsButton");
const updateStatusEl = document.querySelector("#updateStatus");
const quitButton = document.querySelector("#quitButton");

const tauriInvoke = window.__TAURI__?.core?.invoke;
const tauriConvertFileSrc = window.__TAURI__?.core?.convertFileSrc;
const petDesktop =
  window.petDesktop ||
  (tauriInvoke
    ? {
        listPets: () => tauriInvoke("list_pets"),
        getAppInfo: () => tauriInvoke("get_app_info"),
        openDownloads: () => tauriInvoke("open_downloads"),
        importPetpack: (data) => tauriInvoke("import_petpack", { data }),
        uninstallPet: (id) => tauriInvoke("uninstall_pet", { id }),
        revealPet: (id) => tauriInvoke("reveal_pet", { id }),
        moveBy: (x, y) => tauriInvoke("move_by", { x, y }),
        setIgnoreMouseEvents: (ignored) => tauriInvoke("set_ignore_mouse_events", { ignored }),
        resetPosition: () => tauriInvoke("reset_position"),
        setAlwaysOnTop: (value) => tauriInvoke("set_always_on_top", { value }),
        getWindowState: () => tauriInvoke("get_window_state"),
        quit: () => tauriInvoke("quit")
      }
    : null);
const isTauriRuntime = Boolean(tauriInvoke);

function resolveSpritesheetSource(pet) {
  if (!pet) {
    return "";
  }
  const revision = pet.spritesheetRevision || pet.version || "";
  const appendRevision = (source) => {
    if (!source || !revision) {
      return source;
    }
    const separator = source.includes("?") ? "&" : "?";
    return `${source}${separator}spriteRevision=${encodeURIComponent(revision)}`;
  };
  if (typeof tauriConvertFileSrc === "function" && pet.spritesheetPath) {
    return appendRevision(tauriConvertFileSrc(pet.spritesheetPath));
  }
  return appendRevision(pet.spritesheetUrl || "");
}

let pets = [];
let activePet = null;
let stateName = "idle";
let frame = 0;
let lastFrameAt = 0;
let onceReturnState = "idle";
let dragging = false;
let pointerInsideInteractiveArea = false;
let dragLastScreenX = 0;
let dragLastScreenY = 0;
let wanderTimer = 0;
let wanderDirection = 0;
let wanderUntil = 0;
let appInfo = {
  version: "0.0.0",
  downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
  latestReleaseApi: "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest"
};

function hasActivePet() {
  return Boolean(activePet && pets.some((pet) => pet.id === activePet.id));
}

function setMousePassthrough(ignored) {
  if (isTauriRuntime) {
    return;
  }
  petDesktop?.setIgnoreMouseEvents(ignored);
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("#pet, #emptyState, #panel, #panelBackdrop"));
}

function updateMousePassthrough(event) {
  const shouldReceiveMouse = dragging || isInteractiveTarget(event.target);
  if (pointerInsideInteractiveArea === shouldReceiveMouse) {
    return;
  }
  pointerInsideInteractiveArea = shouldReceiveMouse;
  setMousePassthrough(!shouldReceiveMouse);
}

function stopWander() {
  wanderDirection = 0;
  wanderUntil = 0;
  window.clearTimeout(wanderTimer);
}

function setFrame() {
  const state = STATES[stateName] || STATES.idle;
  const x = -(frame % state.frames) * CELL_WIDTH;
  const y = -state.row * CELL_HEIGHT;
  petEl.style.backgroundPosition = `${x}px ${y}px`;
}

function setState(nextState, { onceReturn = "idle" } = {}) {
  if (!STATES[nextState]) {
    return;
  }
  stateName = nextState;
  frame = 0;
  lastFrameAt = 0;
  onceReturnState = onceReturn;
  stateSelect.value = nextState;
  setFrame();
}

function animationLoop(now) {
  const state = STATES[stateName] || STATES.idle;
  const delay = 1000 / state.fps;
  if (!lastFrameAt || now - lastFrameAt >= delay) {
    frame += 1;
    if (frame >= state.frames) {
      if (state.once) {
        setState(onceReturnState);
      } else {
        frame = 0;
      }
    }
    setFrame();
    lastFrameAt = now;
  }
  requestAnimationFrame(animationLoop);
}

function pickPet(id) {
  activePet = pets.find((pet) => pet.id === id) || pets[0];
  if (!activePet) {
    stopWander();
    petEl.style.backgroundImage = "";
    petEl.setAttribute("aria-label", "No pet found");
    petEl.textContent = "";
    petEl.classList.add("empty");
    emptyStateEl.classList.remove("hidden");
    return;
  }
  petEl.classList.remove("empty");
  emptyStateEl.classList.add("hidden");
  const source = resolveSpritesheetSource(activePet);
  petEl.style.backgroundImage = source ? `url("${source}")` : "";
  petEl.textContent = "";
  petEl.setAttribute("aria-label", activePet.displayName);
  petSelect.value = activePet.id;
  setState("idle");
  scheduleWander();
}

function renderPetOptions() {
  petSelect.replaceChildren(
    ...pets.map((pet) => {
      const option = document.createElement("option");
      option.value = pet.id;
      option.textContent = pet.displayName;
      return option;
    })
  );
}

function versionLabel(pet) {
  return pet?.version ? pet.version : "unversioned";
}

function setPetStatus(message) {
  if (petStatusEl) {
    petStatusEl.textContent = message || "";
  }
}

function setUpdateStatus(message) {
  if (updateStatusEl) {
    updateStatusEl.textContent = message || "";
  }
}

function cleanVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[+-]/)[0];
}

function versionParts(value) {
  return cleanVersion(value)
    .split(".")
    .slice(0, 3)
    .map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
}

function compareVersions(left, right) {
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

async function checkForUpdates() {
  if (!appInfo.latestReleaseApi || typeof fetch !== "function") {
    setUpdateStatus("检查更新不可用。");
    return;
  }
  checkUpdateButton.disabled = true;
  setUpdateStatus("正在检查更新...");
  try {
    const response = await fetch(appInfo.latestReleaseApi, {
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
    if (compareVersions(latestTag, appInfo.version) > 0) {
      setUpdateStatus(`发现新版本 ${latestTag}，点击 Open Downloads 下载。`);
      return;
    }
    setUpdateStatus(`当前已是最新版本 v${cleanVersion(appInfo.version)}。`);
  } catch (error) {
    setUpdateStatus(`检查更新失败：${error.message}`);
  } finally {
    checkUpdateButton.disabled = false;
  }
}

function renderPetManager() {
  if (!petManagerEl) {
    return;
  }
  if (!pets.length) {
    const empty = document.createElement("div");
    empty.className = "pet-manager-empty";
    empty.textContent = "No pets installed.";
    petManagerEl.replaceChildren(empty);
    return;
  }
  petManagerEl.replaceChildren(
    ...pets.map((pet) => {
      const row = document.createElement("article");
      row.className = "pet-manager-row";

      const title = document.createElement("div");
      title.className = "pet-manager-title";
      const name = document.createElement("span");
      name.textContent = pet.displayName;
      const version = document.createElement("span");
      version.textContent = versionLabel(pet);
      title.append(name, version);

      const meta = document.createElement("div");
      meta.className = "pet-manager-meta";
      meta.textContent = `${pet.id} · ${pet.sourceKind || "external"}`;

      const actions = document.createElement("div");
      actions.className = "pet-manager-actions";
      const reveal = document.createElement("button");
      reveal.type = "button";
      reveal.textContent = "Reveal";
      reveal.addEventListener("click", () => {
        petDesktop?.revealPet?.(pet.id).catch((error) => setPetStatus(error.message));
      });
      const uninstall = document.createElement("button");
      uninstall.type = "button";
      uninstall.textContent = "Uninstall";
      uninstall.disabled = !pet.canUninstall;
      uninstall.addEventListener("click", () => {
        uninstallPet(pet).catch((error) => setPetStatus(error.message));
      });
      actions.append(reveal, uninstall);

      row.append(title, meta, actions);
      return row;
    })
  );
}

function refreshPetList(result, preferredPetId) {
  pets = result.pets || [];
  renderPetOptions();
  renderPetManager();
  pickPet(preferredPetId || pets[0]?.id);
  if (result.errors?.length) {
    setPetStatus(`Skipped ${result.errors.length} invalid pet folder(s).`);
  }
}

function renderStateOptions() {
  stateSelect.replaceChildren(
    ...Object.keys(STATES).map((state) => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      return option;
    })
  );
}

function scheduleWander() {
  window.clearTimeout(wanderTimer);
  if (!hasActivePet()) {
    wanderDirection = 0;
    wanderUntil = 0;
    return;
  }
  wanderTimer = window.setTimeout(() => {
    if (
      !hasActivePet() ||
      !wanderToggle.checked ||
      dragging ||
      panelEl.classList.contains("hidden") === false
    ) {
      scheduleWander();
      return;
    }
    const directions = [-1, 1, 0];
    wanderDirection = directions[Math.floor(Math.random() * directions.length)];
    wanderUntil = performance.now() + (wanderDirection === 0 ? 1800 : 3200);
    if (wanderDirection < 0) {
      setState("running-left");
    } else if (wanderDirection > 0) {
      setState("running-right");
    } else {
      setState("waiting");
    }
  }, 3500 + Math.random() * 4500);
}

function wanderLoop(now) {
  if (
    hasActivePet() &&
    wanderDirection !== 0 &&
    now < wanderUntil &&
    wanderToggle.checked &&
    !dragging
  ) {
    petDesktop?.moveBy(wanderDirection * 2, 0);
  }
  if (wanderUntil && now >= wanderUntil) {
    wanderDirection = 0;
    wanderUntil = 0;
    setState("idle");
    scheduleWander();
  }
  requestAnimationFrame(wanderLoop);
}

function setPanelVisible(show) {
  if (show && !pets.length) {
    show = false;
  }
  panelEl.classList.toggle("hidden", !show);
  panelBackdropEl.classList.toggle("hidden", !show);
  setMousePassthrough(false);
}

function togglePanel(show = panelEl.classList.contains("hidden")) {
  setPanelVisible(show);
}

petEl.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  stopWander();
  dragging = true;
  pointerInsideInteractiveArea = true;
  dragLastScreenX = event.screenX;
  dragLastScreenY = event.screenY;
  setMousePassthrough(false);
  petEl.setPointerCapture?.(event.pointerId);
});

petEl.addEventListener("pointermove", (event) => {
  if (!dragging) {
    return;
  }
  const deltaX = event.screenX - dragLastScreenX;
  const deltaY = event.screenY - dragLastScreenY;
  dragLastScreenX = event.screenX;
  dragLastScreenY = event.screenY;
  if (deltaX || deltaY) {
    petDesktop?.moveBy(deltaX, deltaY);
  }
});

function finishDrag(event) {
  if (!dragging) {
    return;
  }
  dragging = false;
  petEl.releasePointerCapture?.(event.pointerId);
  scheduleWander();
}

petEl.addEventListener("pointerup", finishDrag);
petEl.addEventListener("pointercancel", finishDrag);
petEl.addEventListener("lostpointercapture", () => {
  if (dragging) {
    dragging = false;
    scheduleWander();
  }
});

petEl.addEventListener("click", () => {
  if (!dragging && panelEl.classList.contains("hidden")) {
    setState("waving");
  }
});

petEl.addEventListener("dblclick", () => {
  setState("jumping");
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (!pets.length) {
    return;
  }
  if (panelEl.contains(event.target)) {
    return;
  }
  togglePanel();
});

document.addEventListener("pointerdown", (event) => {
  if (!dragging && !panelEl.classList.contains("hidden") && !isInteractiveTarget(event.target)) {
    setPanelVisible(false);
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

window.addEventListener("blur", () => {
  if (!dragging) {
    setPanelVisible(false);
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

document.addEventListener("mousemove", updateMousePassthrough);
document.addEventListener("mouseleave", () => {
  if (!dragging && panelEl.classList.contains("hidden")) {
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

panelEl.addEventListener("pointerenter", () => setMousePassthrough(false));
emptyStateEl.addEventListener("pointerenter", () => setMousePassthrough(false));
panelEl.addEventListener("pointerleave", () => {
  if (!dragging) {
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});
emptyStateEl.addEventListener("pointerleave", () => {
  if (!dragging) {
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

petSelect.addEventListener("change", () => pickPet(petSelect.value));
stateSelect.addEventListener("change", () => setState(stateSelect.value));
scaleRange.addEventListener("input", () => {
  document.documentElement.style.setProperty("--scale", scaleRange.value);
});
topToggle.addEventListener("change", () => {
  petDesktop?.setAlwaysOnTop(topToggle.checked);
});

checkUpdateButton?.addEventListener("click", () => {
  checkForUpdates();
});

openDownloadsButton?.addEventListener("click", () => {
  petDesktop
    ?.openDownloads?.()
    .then(() => setUpdateStatus("已打开下载页。"))
    .catch((error) => setUpdateStatus(`打开下载页失败：${error.message}`));
});

function openPetpackPicker() {
  petpackInput.value = "";
  petpackInput.click();
}

async function readFileAsBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function importSelectedPetpack(file) {
  if (!file) {
    return;
  }
  const data = await readFileAsBase64(file);
  const result = await petDesktop.importPetpack(data);
  refreshPetList(result.pets, result.importedPetId);
  if (result.replaced) {
    setPetStatus(
      `已覆盖 ${result.displayName || result.importedPetId}: ${result.previousVersion || "unknown"} -> ${
        result.version || "unknown"
      }`
    );
  } else {
    setPetStatus(`已导入 ${result.displayName || result.importedPetId} ${result.version || ""}`.trim());
  }
  setPanelVisible(false);
}

async function uninstallPet(pet) {
  if (!pet?.canUninstall) {
    setPetStatus("Only imported app-data petpacks can be uninstalled here.");
    return;
  }
  const result = await petDesktop.uninstallPet(pet.id);
  setPetStatus(`已卸载 ${pet.displayName}`);
  refreshPetList(result, activePet?.id === pet.id ? undefined : activePet?.id);
}

importButton.addEventListener("click", openPetpackPicker);
importEmptyButton.addEventListener("click", openPetpackPicker);
petpackInput.addEventListener("change", () => {
  importSelectedPetpack(petpackInput.files?.[0]).catch((error) => {
    if (!pets.length) {
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.querySelector("span").textContent = error.message;
    }
    setPetStatus(error.message);
  });
});
quitButton.addEventListener("click", () => {
  petDesktop?.quit();
});

async function init() {
  if (!petDesktop) {
    throw new Error("Desktop bridge is not available.");
  }
  renderStateOptions();
  appInfo = (await petDesktop.getAppInfo?.()) || appInfo;
  setUpdateStatus(`当前版本 v${cleanVersion(appInfo.version)}`);
  const windowState = await petDesktop.getWindowState();
  topToggle.checked = Boolean(windowState.alwaysOnTop);
  refreshPetList(await petDesktop.listPets());
  setMousePassthrough(true);
  requestAnimationFrame(animationLoop);
  requestAnimationFrame(wanderLoop);
  if (hasActivePet()) {
    scheduleWander();
  }
}

init().catch((error) => {
  petEl.textContent = error.message;
});
