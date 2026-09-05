import { createAnimation } from "./animation.js";
import { attachGrowth } from "./growth-layer.js";
import { createDesktopBridge } from "./bridge.js";
import { getDomRefs, setElementText } from "./dom.js";
import { createImportFlow } from "./import-flow.js";
import { createInteractions } from "./interactions.js";
import { createPetManager } from "./pet-manager.js";
import { createStoreController } from "./store.js";
import { createUpdateController } from "./updates.js";
import { createWindowLayout } from "./window-layout.js";
import { cleanVersion } from "./version.js";

const dom = getDomRefs();
const { petDesktop, tauriConvertFileSrc, listenTrayCommand, listenAppUpdateDownloadProgress, listenTyping } =
  createDesktopBridge();
const state = {
  pets: [],
  activePet: null,
  pendingImport: null,
  preferences: {
    selectedPetId: "",
    scale: 0.9,
    petDirection: "right",
    autoWander: true,
    naturalLife: true,
    alwaysOnTop: true,
    careCount: 0
  },
  appInfo: {
    version: "0.0.0",
    platform: "",
    downloadsUrl: "https://donosov999-ai.github.io/codex-pet-desktop/",
    latestReleaseApi: "https://api.github.com/repos/donosov999-ai/codex-pet-desktop/releases/latest",
    // Packs come from the shared channel, the same domain the web engine uses. Art now reaches
    // the user without a rebuild: publish to the channel and the store picks it up. GitHub Pages
    // stays reachable but is no longer the source — one domain, one place to publish.
    petpackIndexUrl: "https://mascot.asibots.pro/desktop/petpacks.json"
  }
};

function setPetStatus(message) {
  setElementText(dom.petStatusEl, message);
}

function setUpdateStatus(message) {
  setElementText(dom.updateStatusEl, message);
}

function currentPreferences(overrides = {}) {
  return {
    selectedPetId: state.activePet?.id || dom.petSelect.value || "",
    scale: Number(dom.scaleRange.value) || 0.9,
    petDirection: state.preferences.petDirection || "right",
    autoWander: Boolean(dom.wanderToggle.checked),
    naturalLife: Boolean(dom.naturalLifeToggle.checked),
    alwaysOnTop: Boolean(dom.topToggle.checked),
    ...overrides
  };
}

function savePreferences(overrides = {}) {
  const preferences = currentPreferences(overrides);
  state.preferences = preferences;
  return petDesktop?.savePreferences?.(preferences)?.catch((error) => {
    setPetStatus(`Failed to save settings: ${error.message}`);
  });
}

function syncTrayState() {
  return petDesktop
    ?.updateTrayState?.({
      autoWander: Boolean(dom.wanderToggle.checked),
      alwaysOnTop: Boolean(dom.topToggle.checked)
    })
    ?.catch(() => {});
}

/// The pet grows as it is cared for. The formula lives in window-layout because the window size
/// depends on it too — two copies would drift apart and clip the pet's head off.
/// Growth is a change of FORM, not of size.
///
/// This used to scale the pet from 0.7x to 1.3x as care actions piled up, and the owner rejected
/// that model on 2026-08-16: the same drawing getting bigger reads as a zoom, not as progress.
/// The shared model (levels, named forms, a ring around the pet, a card when the form changes)
/// lives in growth-layer.js. `--growth` is pinned to 1 so the sprite keeps its intended size;
/// the variable itself stays because renderer.css multiplies by it in two places.
let growthLayer = null;

function applyGrowth() {
  document.documentElement.style.setProperty("--growth", "1");
  return 1;
}

/// One more act of care: remember it and let the pet grow a little. Called from interactions.
function recordCare() {
  const careCount = (Number(state.preferences.careCount) || 0) + 1;
  state.preferences.careCount = careCount;
  applyGrowth();
  growthLayer?.record();          // no layer (engine missing) → care still counts, just no ring
  savePreferences({ careCount });
}

function applyPreferences(preferences) {
  state.preferences = { ...state.preferences, ...(preferences || {}) };
  dom.scaleRange.value = String(state.preferences.scale || 0.9);
  document.documentElement.style.setProperty("--scale", dom.scaleRange.value);
  applyGrowth();
  applyPetDirection(state.preferences.petDirection);
  dom.wanderToggle.checked = state.preferences.autoWander !== false;
  dom.naturalLifeToggle.checked = state.preferences.naturalLife !== false;
  dom.topToggle.checked = state.preferences.alwaysOnTop !== false;
}

function normalizedPetDirection(direction) {
  return direction === "left" ? "left" : "right";
}

function directionLabel(direction) {
  return direction === "left" ? "left" : "right";
}

function applyPetDirection(direction) {
  const nextDirection = normalizedPetDirection(direction);
  state.preferences.petDirection = nextDirection;
  animation.setDirection(nextDirection);
  dom.directionLeftButton?.classList.toggle("active", nextDirection === "left");
  dom.directionRightButton?.classList.toggle("active", nextDirection === "right");
}

function setPetDirection(direction) {
  const nextDirection = normalizedPetDirection(direction);
  applyPetDirection(nextDirection);
  setPetStatus(`Switched to ${directionLabel(nextDirection)}.`);
  savePreferences({ petDirection: nextDirection });
}

const animation = createAnimation(dom);
const windowLayout = createWindowLayout({ dom, petDesktop, state, animation });
/// The pet works alongside you: while you type anywhere on the desktop it types too, and it drops
/// the act shortly after you stop. Only if the pack actually has the state — a mascot without a
/// keyboard drawn would look like it was miming.
function startWorkingAlongside() {
  const WORK_STATE = "work-type";
  const STOP_AFTER_MS = 2500;
  let stopTimer = 0;
  let working = false;

  listenTyping?.(() => {
    if (!animation.getCareState?.(WORK_STATE)) {
      return;
    }
    if (!working) {
      working = animation.setState(WORK_STATE);
    }
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      working = false;
      animation.setState("idle");
    }, STOP_AFTER_MS);
  });
}

const interactions = createInteractions({
  animation,
  dom,
  onCare: recordCare,
  onLayoutChange: windowLayout.syncWindowLayout,
  petDesktop,
  state
});
const petManager = createPetManager({
  animation,
  dom,
  petDesktop,
  playCareAction: interactions.playCareAction,
  scheduleWander: interactions.scheduleWander,
  setPetStatus,
  state,
  stopWander: interactions.stopWander,
  syncWindowLayout: windowLayout.syncWindowLayout,
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
const updates = createUpdateController({ dom, listenAppUpdateDownloadProgress, petDesktop, setUpdateStatus, state });

function setPanelTab(tabId) {
  const tabs = [
    [dom.tabControl, dom.controlSection],
    [dom.tabStore, dom.storeSection],
    [dom.tabManager, dom.managerSection],
    [dom.tabUpdate, dom.updateSection]
  ];
  for (const [button, section] of tabs) {
    const active = section?.id === tabId;
    button?.classList.toggle("active", active);
    section?.classList.toggle("hidden", !active);
  }
}

function setWanderPaused(paused) {
  dom.wanderToggle.checked = !paused;
  if (paused) {
    interactions.stopWander();
    setPetStatus("Automatic wandering paused.");
    savePreferences({ autoWander: false });
    syncTrayState();
    return;
  }
  if (interactions.hasActivePet()) {
    interactions.scheduleWander();
  }
  setPetStatus("Automatic wandering resumed.");
  savePreferences({ autoWander: true });
  syncTrayState();
}

async function openStorePanel() {
  interactions.setPanelVisible(true);
  setPanelTab("storeSection");
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
  applyPreferences((await petDesktop.getPreferences?.()) || {});
  interactions.refreshLifeEngine();
  await windowLayout.syncWindowLayout();
  setUpdateStatus(`Current version v${cleanVersion(state.appInfo.version)}`);

  const windowState = await petDesktop.getWindowState();
  if (!state.preferences.alwaysOnTop && windowState.alwaysOnTop) {
    await petDesktop.setAlwaysOnTop(false);
  } else if (state.preferences.alwaysOnTop) {
    dom.topToggle.checked = Boolean(windowState.alwaysOnTop);
  }
  petManager.refreshPetList(await petDesktop.listPets(), state.preferences.selectedPetId);
  interactions.setMousePassthrough(true);

  // Growth attaches AFTER the pack is chosen: the archetype decides which set of form names the
  // pet uses, and that comes from the pack. Awaited but never fatal — a missing engine returns a
  // no-op layer and the app runs exactly as before.
  // ⚠️ ONLY WHEN A PET IS ACTUALLY INSTALLED. Attaching to the empty pet element put the ring
  // and the card inside it, and the first-run import preview stopped showing — caught by
  // "Renderer empty smoke", which is green on a clean tree and red with the layer attached
  // unconditionally. With no pet there is nothing to grow anyway.
  if (state.activePet) {
    // NOT awaited: growth is decoration and must never delay a working pet. Boot continues, the
    // layer wires itself in when the engine has loaded, and `growthLayer?.record()` is a no-op
    // until then — an act of care during those milliseconds is still counted and saved.
    attachGrowth({ host: dom.petEl, pet: state.activePet, careCount: state.preferences.careCount })
      .then((layer) => { growthLayer = layer; })
      .catch(() => { growthLayer = null; });
  }

  interactions.bind({ pickPet: petManager.pickPet });
  importFlow.bind();
  store.bind();
  updates.bind();
  [
    dom.tabControl,
    dom.tabStore,
    dom.tabManager,
    dom.tabUpdate
  ].forEach((tab) => {
    tab?.addEventListener("click", () => {
      setPanelTab(tab.dataset.panelTab);
    });
  });
  dom.openStoreButton?.addEventListener("click", () => {
    openStorePanel();
  });
  dom.openStoreEmptyButton?.addEventListener("click", () => {
    openStorePanel();
  });
  dom.scaleRange.addEventListener("input", () => {
    windowLayout.syncWindowLayout().catch(() => {});
    savePreferences({ scale: Number(dom.scaleRange.value) || 0.9 });
  });
  [dom.directionLeftButton, dom.directionRightButton].forEach((button) => {
    button?.addEventListener("click", () => {
      setPetDirection(button.dataset.petDirection);
    });
  });
  dom.wanderToggle.addEventListener("change", () => {
    savePreferences({ autoWander: Boolean(dom.wanderToggle.checked) });
    syncTrayState();
  });
  dom.naturalLifeToggle.addEventListener("change", () => {
    state.preferences = currentPreferences({ naturalLife: Boolean(dom.naturalLifeToggle.checked) });
    interactions.refreshLifeEngine();
    savePreferences({ naturalLife: Boolean(dom.naturalLifeToggle.checked) });
  });
  dom.topToggle.addEventListener("change", () => {
    savePreferences({ alwaysOnTop: Boolean(dom.topToggle.checked) });
    syncTrayState();
  });
  dom.petSelect.addEventListener("change", () => {
    savePreferences({ selectedPetId: dom.petSelect.value });
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
  } else {
    await openStorePanel();
  }
  syncTrayState();
}

init().catch((error) => {
  dom.petEl.textContent = error.message;
});

startWorkingAlongside();
