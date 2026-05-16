import { createAnimation } from "./animation.js";
import { createDesktopBridge } from "./bridge.js";
import { getDomRefs, setElementText } from "./dom.js";
import { createImportFlow } from "./import-flow.js";
import { createInteractions } from "./interactions.js";
import { createPetManager } from "./pet-manager.js";
import { createUpdateController } from "./updates.js";
import { cleanVersion } from "./version.js";

const dom = getDomRefs();
const { petDesktop, tauriConvertFileSrc } = createDesktopBridge();
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
const updates = createUpdateController({ dom, petDesktop, setUpdateStatus, state });

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
  updates.bind();
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
