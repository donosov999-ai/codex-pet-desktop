const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const resizeCalls = [];
  const centerCalls = [];
  const pet = {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };

  const { elements, flush } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.8", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ scale: 0.6, autoWander: false }),
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
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resizeWindow: async (width, height) => {
        resizeCalls.push({ width, height });
      },
      centerPosition: async () => {
        centerCalls.push(true);
      },
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  const initialPetWindow = resizeCalls.at(-1);
  if (!initialPetWindow || initialPetWindow.width > 240 || initialPetWindow.height > 260) {
    console.error(JSON.stringify({ ok: false, reason: "pet-only window was not compact", resizeCalls }, null, 2));
    process.exit(1);
  }

  elements.get("#scaleRange").value = "1.8";
  elements.get("#scaleRange").dispatch("input");
  await flush();
  const largePetWindow = resizeCalls.at(-1);
  if (!largePetWindow || largePetWindow.width <= initialPetWindow.width || largePetWindow.height <= initialPetWindow.height) {
    console.error(JSON.stringify({ ok: false, reason: "window did not grow with pet scale", resizeCalls }, null, 2));
    process.exit(1);
  }

  elements.get("#openStoreButton").click();
  await flush();
  const panelWindow = resizeCalls.at(-1);
  if (!panelWindow || panelWindow.width < 340 || panelWindow.height < 420) {
    console.error(JSON.stringify({ ok: false, reason: "panel window was not expanded", resizeCalls }, null, 2));
    process.exit(1);
  }

  if (centerCalls.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "active pet layout should not recenter window", centerCalls }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, resizeCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
