const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const pet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const randomValues = [0, 0, 0, 0.9, 0.1];
  const { elements, timeouts } = await loadRenderer({
    random: () => randomValues.shift() ?? 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.3", latestReleaseApi: "", petpackIndexUrl: "" }),
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
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "review") {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "idle natural behavior did not choose a quiet action",
        state: elements.get("#stateSelect").value
      })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, state: elements.get("#stateSelect").value }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
