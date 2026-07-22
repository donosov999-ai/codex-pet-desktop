const { loadRenderer } = require("./renderer-smoke-harness");
const biruzikManifest = require("../resources/pets/biruzik/pet.json");

async function main() {
  const moveCalls = [];
  const resizeCalls = [];
  const pet = {
    ...biruzikManifest,
    spritesheetUrl: "biruzik-standard.webp",
    behavior: {
      doubleClickState: "jumping",
      idleStates: ["idle"],
      wanderDirections: [1],
      natural: {
        nextWanderDelayMs: [1, 1],
        walkDurationMs: [5000, 5000]
      }
    },
    care: {
      ...biruzikManifest.care,
      spritesheetUrl: "biruzik-care.webp",
    }
  };

  const { animationFrames, elements, flush, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.30", platform: "windows" }),
      getPreferences: async () => ({ scale: 0.9, autoWander: true, naturalLife: true }),
      savePreferences: async (value) => value,
      moveBy: async (x, y) => {
        moveCalls.push([x, y]);
        return { hitEdge: "" };
      },
      resizeWindow: async (width, height, anchor) => {
        resizeCalls.push({ width, height, anchor });
      },
      setIgnoreMouseEvents: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  const petElement = elements.get("#pet");
  const careActions = elements.get("#careActions");
  function advanceAnimation(now) {
    for (const callback of animationFrames.splice(0, animationFrames.length)) {
      callback(now);
    }
  }
  if (careActions.children.length !== 5) {
    throw new Error(`expected 5 care actions, found ${careActions.children.length}`);
  }

  petElement.dispatch("pointerenter");
  timeouts.at(-1)?.();
  advanceAnimation(1000);
  await flush();
  if (moveCalls.length !== 0) {
    throw new Error("hover must pause autonomous movement");
  }

  petElement.dispatch("dblclick");
  await flush();
  if (elements.get("#panel").classList.contains("hidden")) {
    throw new Error("double click must open care controls");
  }
  const expanded = resizeCalls.at(-1);
  if (!expanded || expanded.width < 520 || expanded.height < 440) {
    throw new Error(`care panel did not expand the window: ${JSON.stringify(expanded)}`);
  }

  careActions.children.find((button) => button.dataset.careState === "eat")?.click();
  if (elements.get("#stateSelect").value !== "eat") {
    throw new Error("care action did not switch to eat state");
  }
  advanceAnimation(3000);
  advanceAnimation(23999);
  if (elements.get("#stateSelect").value !== "eat") {
    throw new Error("eat action ended before its 12 complete cycles");
  }
  advanceAnimation(24000);
  if (elements.get("#stateSelect").value !== "idle") {
    throw new Error("eat action did not finish after 24 seconds");
  }

  careActions.children.find((button) => button.dataset.careState === "sleep")?.click();
  advanceAnimation(59000);
  if (elements.get("#stateSelect").value !== "sleep") {
    throw new Error("sleep action ended before 60 seconds");
  }
  advanceAnimation(60000);
  if (elements.get("#stateSelect").value !== "idle") {
    throw new Error("sleep action did not finish after 60 seconds");
  }

  console.log(
    JSON.stringify({ ok: true, careActions: careActions.children.length, eatDurationMs: 24000, sleepDurationMs: 60000, expanded }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
