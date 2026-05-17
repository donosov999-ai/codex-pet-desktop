const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const saveCalls = [];
  const alwaysOnTopCalls = [];
  const pets = [
    {
      id: "mi-fen",
      displayName: "米粉",
      version: "1.0.2",
      sourceKind: "managed",
      canUninstall: true,
      spritesheetPath: "/pets/mi-fen/spritesheet.webp"
    },
    {
      id: "mi-jiu",
      displayName: "米酒",
      version: "1.0.0",
      sourceKind: "managed",
      canUninstall: true,
      spritesheetPath: "/pets/mi-jiu/spritesheet.webp"
    }
  ];

  const { elements, flush } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets, errors: [] }),
      getAppInfo: async () => ({ version: "0.2.3", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({
        selectedPetId: "mi-jiu",
        scale: 1.1,
        autoWander: false,
        alwaysOnTop: false
      }),
      savePreferences: async (preferences) => {
        saveCalls.push(preferences);
        return preferences;
      },
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
      resetPosition: async () => {},
      setAlwaysOnTop: async (value) => {
        alwaysOnTopCalls.push(value);
      },
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  if (
    elements.get("#petSelect").value !== "mi-jiu" ||
    elements.get("#scaleRange").value !== "1.1" ||
    elements.get("#wanderToggle").checked ||
    elements.get("#topToggle").checked
  ) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "stored preferences were not applied",
        pet: elements.get("#petSelect").value,
        scale: elements.get("#scaleRange").value,
        autoWander: elements.get("#wanderToggle").checked,
        top: elements.get("#topToggle").checked
      })
    );
    process.exit(1);
  }

  elements.get("#scaleRange").value = "1.3";
  elements.get("#scaleRange").dispatch("input");
  elements.get("#wanderToggle").checked = true;
  elements.get("#wanderToggle").dispatch("change");
  elements.get("#topToggle").checked = true;
  elements.get("#topToggle").dispatch("change");
  elements.get("#petSelect").value = "mi-fen";
  elements.get("#petSelect").dispatch("change");
  await flush();

  const merged = Object.assign({}, ...saveCalls);
  if (
    saveCalls.length < 4 ||
    merged.scale !== 1.3 ||
    merged.autoWander !== true ||
    merged.alwaysOnTop !== true ||
    merged.selectedPetId !== "mi-fen" ||
    alwaysOnTopCalls.at(-1) !== true
  ) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "preference changes were not persisted",
        saveCalls,
        alwaysOnTopCalls
      })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, saveCalls, alwaysOnTopCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
