const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const trayCalls = [];
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
      getAppInfo: async () => ({ version: "0.2.3", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ autoWander: true, alwaysOnTop: true }),
      savePreferences: async (value) => value,
      updateTrayState: async (state) => {
        trayCalls.push(state);
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
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });
  await flush();

  elements.get("#wanderToggle").checked = false;
  elements.get("#wanderToggle").dispatch("change");
  elements.get("#topToggle").checked = false;
  elements.get("#topToggle").dispatch("change");
  await flush();

  const latest = trayCalls.at(-1);
  if (!trayCalls.length || latest.autoWander !== false || latest.alwaysOnTop !== false) {
    console.error(JSON.stringify({ ok: false, reason: "tray state not synchronized", trayCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, trayCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
