const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const pet = {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const { elements, flush } = await loadRenderer({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        tag_name: "v0.2.4",
        html_url: "https://github.com/donosov999-ai/codex-pet-desktop/releases/tag/v0.2.4",
        body: "Added persistent settings\nImproved the pet catalog"
      })
    }),
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.3",
        latestReleaseApi: "https://api.github.com/repos/donosov999-ai/codex-pet-desktop/releases/latest",
        petpackIndexUrl: ""
      }),
      getPreferences: async () => ({}),
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

  elements.get("#checkUpdateButton").click();
  await flush();

  const updateText = elements.get("#updateStatus").textContent;
  if (
    !updateText.includes("current v0.2.3") ||
    !updateText.includes("latest v0.2.4") ||
    !updateText.includes("Added persistent settings") ||
    !updateText.includes("Open downloads")
  ) {
    console.error(JSON.stringify({ ok: false, reason: "update detail text missing", updateText }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, updateText }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
