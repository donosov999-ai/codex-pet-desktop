import { createAnimation } from "./animation.js";
import { createDesktopBridge } from "./bridge.js";
import { getDomRefs, setElementText } from "./dom.js";
import { createImportFlow } from "./import-flow.js";
import { createInteractions } from "./interactions.js";
import { createPetManager } from "./pet-manager.js";
import { createStoreController } from "./store.js";
import { createUpdateController } from "./updates.js";
import { cleanVersion } from "./version.js";

const dom = getDomRefs();
const { petDesktop, tauriConvertFileSrc, listenTrayCommand } = createDesktopBridge();
const state = {
  pets: [],
  activePet: null,
  pendingImport: null,
  appInfo: {
    version: "0.0.0",
    downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
    latestReleaseApi: "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest",
    petpackIndexUrl: "https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json"
  }
};

function setPetStatus(message) {
  setElementText(dom.petStatusEl, message);
}

function setUpdateStatus(message) {
  setElementText(dom.updateStatusEl, message);
}

const animation = createAnimation(dom);
const interactions = createInteractions({ animation, dom, petDesktop, state });
const petManager = createPetManager({
  animation,
  dom,
  petDesktop,
  scheduleWander: interactions.scheduleWander,
  setPetStatus,
  state,
  stopWander: interactions.stopWander,
  tauriConvertFileSrc
});
const importFlow = createImportFlow({
  dom,
  petDesktop,
  refreshPetList: petManager.refreshPetList,
  setPanelVisible: interactions.setPanelVisible,
  setPetStatus,
  state
});
const store = createStoreController({
  dom,
  petDesktop,
  refreshPetList: petManager.refreshPetList,
  state
});
const updates = createUpdateController({ dom, petDesktop, setUpdateStatus, state });

function setWanderPaused(paused) {
  dom.wanderToggle.checked = !paused;
  if (paused) {
    interactions.stopWander();
    setPetStatus("已暂停自动散步。");
    return;
  }
  if (interactions.hasActivePet()) {
    interactions.scheduleWander();
  }
  setPetStatus("已恢复自动散步。");
}

async function openStorePanel() {
  interactions.setPanelVisible(true);
  await store.openStore();
}

async function handleTrayCommand(payload) {
  const command = typeof payload === "string" ? payload : payload?.command;
  if (command === "pause_wander") {
    setWanderPaused(true);
  } else if (command === "resume_wander") {
    setWanderPaused(false);
  } else if (command === "open_store") {
    await openStorePanel();
  }
}

async function init() {
  if (!petDesktop) {
    throw new Error("Desktop bridge is not available.");
  }

  animation.renderStateOptions();
  state.appInfo = { ...state.appInfo, ...((await petDesktop.getAppInfo?.()) || {}) };
  setUpdateStatus(`当前版本 v${cleanVersion(state.appInfo.version)}`);

  const windowState = await petDesktop.getWindowState();
  dom.topToggle.checked = Boolean(windowState.alwaysOnTop);
  petManager.refreshPetList(await petDesktop.listPets());
  interactions.setMousePassthrough(true);

  interactions.bind({ pickPet: petManager.pickPet });
  importFlow.bind();
  store.bind();
  updates.bind();
  dom.openStoreButton?.addEventListener("click", () => {
    openStorePanel();
  });
  dom.openStoreEmptyButton?.addEventListener("click", () => {
    openStorePanel();
  });
  listenTrayCommand?.((payload) => {
    handleTrayCommand(payload).catch((error) => setPetStatus(error.message));
  });
  dom.quitButton.addEventListener("click", () => {
    petDesktop?.quit();
  });

  requestAnimationFrame(animation.animationLoop);
  requestAnimationFrame(interactions.wanderLoop);
  if (interactions.hasActivePet()) {
    interactions.scheduleWander();
  }
}

init().catch((error) => {
  dom.petEl.textContent = error.message;
});
