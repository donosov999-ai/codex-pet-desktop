const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const pet = {
    id: "mi-jiu",
    displayName: "米酒",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-jiu/spritesheet.webp",
    behavior: {
      idleStates: ["idle"],
      wanderDirections: [-1, 1],
      natural: {
        nextWanderDelayMs: [100, 100],
        walkDurationMs: [5000, 5000],
        edgePauseMs: [300, 300],
        edgePauseStates: ["waiting"]
      }
    }
  };
  const { animationFrames, elements, flush, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.8", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ autoWander: true }),
      savePreferences: async (value) => value,
      inspectPetpack: async () => {
        throw new Error("not used");
      },
      importPetpack: async () => {
        throw new Error("not used");
      },
      uninstallPet: async () => ({ pets: [], errors: [] }),
      revealPet: async () => {},
      openDownloads: async () => {},
      moveBy: async () => ({ hitEdge: "left" }),
      setIgnoreMouseEvents: async () => {},
      resizeWindow: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "running-left") {
    console.error(JSON.stringify({ ok: false, reason: "initial wander did not start left", state: elements.get("#stateSelect").value }, null, 2));
    process.exit(1);
  }

  animationFrames[1]?.(100);
  await flush();
  if (elements.get("#stateSelect").value !== "waiting") {
    console.error(JSON.stringify({ ok: false, reason: "edge pause state was not shown", state: elements.get("#stateSelect").value }, null, 2));
    process.exit(1);
  }

  animationFrames.at(-1)?.(301);
  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "running-right") {
    console.error(JSON.stringify({ ok: false, reason: "edge recovery did not prefer opposite direction", state: elements.get("#stateSelect").value }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, state: elements.get("#stateSelect").value }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
