const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const pet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.3",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    behavior: {
      clickState: "waiting",
      doubleClickState: "failed",
      idleStates: ["review"],
      wanderDirections: [0]
    }
  };
  const { elements, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.4", latestReleaseApi: "", petpackIndexUrl: "" }),
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
      moveBy: async () => ({ hitEdge: "" }),
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  elements.get("#pet").click();
  if (elements.get("#stateSelect").value !== "waiting") {
    console.error(JSON.stringify({ ok: false, reason: "clickState behavior ignored", state: elements.get("#stateSelect").value }, null, 2));
    process.exit(1);
  }

  elements.get("#pet").dispatch("dblclick");
  if (elements.get("#stateSelect").value !== "failed") {
    console.error(JSON.stringify({ ok: false, reason: "doubleClickState behavior ignored", state: elements.get("#stateSelect").value }, null, 2));
    process.exit(1);
  }

  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "review") {
    console.error(JSON.stringify({ ok: false, reason: "pet idleStates behavior ignored", state: elements.get("#stateSelect").value }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, state: elements.get("#stateSelect").value }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
