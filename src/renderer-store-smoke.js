const { findByText, loadRenderer, textOf } = require("./renderer-smoke-harness");

async function main() {
  const oldPet = {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    spritesheetRevision: "old"
  };
  const newPet = { ...oldPet, version: "1.0.2", spritesheetRevision: "new" };
  const fetchCalls = [];
  const inspectCalls = [];
  const importCalls = [];

  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).endsWith("/petpacks/petpacks.json")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "mi-fen",
              displayName: "Mi Fen",
              description: "white cat",
              version: "1.0.2",
              fileName: "mi-fen-1.0.2.petpack",
              previewAtlas: "previews/mi-fen-1.0.2-atlas.webp",
              sprite: { cellWidth: 192, cellHeight: 208, width: 1536, height: 1872 }
            },
            {
              id: "mi-jiu",
              displayName: "Mi Jiu",
              description: "dark-coated cat",
              version: "1.0.0",
              fileName: "mi-jiu-1.0.0.petpack",
              previewAtlas: "previews/mi-jiu-1.0.0-atlas.webp",
              sprite: { cellWidth: 192, cellHeight: 208, width: 1536, height: 1872 }
            }
          ]
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
      };
    },
    petDesktop: {
      listPets: async () => ({ pets: [oldPet], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.2",
        latestReleaseApi: "",
        downloadsUrl: "https://donosov999-ai.github.io/codex-pet-desktop/",
        petpackIndexUrl: "https://donosov999-ai.github.io/codex-pet-desktop/petpacks/petpacks.json"
      }),
      inspectPetpack: async (data) => {
        inspectCalls.push(data);
        return {
          id: "mi-fen",
          displayName: "Mi Fen",
          version: "1.0.2",
          existingManagedVersion: "1.0.1",
          existingVisibleVersion: "1.0.1",
          existingVisibleSourceKind: "managed",
          willReplaceManaged: true,
          versionRelation: "upgrade"
        };
      },
      importPetpack: async (data) => {
        importCalls.push(data);
        return {
          importedPetId: "mi-fen",
          displayName: "Mi Fen",
          version: "1.0.2",
          replaced: true,
          previousVersion: "1.0.1",
          pets: { pets: [newPet], errors: [] }
        };
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

  elements.get("#refreshStoreButton").click();
  await flush();

  const storeText = textOf(elements.get("#petStoreList"));
  if (!fetchCalls[0]?.endsWith("/petpacks/petpacks.json") || !storeText.includes("Mi Fen") || !storeText.includes("Update") || !storeText.includes("Mi Jiu") || !storeText.includes("Install")) {
    console.error(JSON.stringify({ ok: false, reason: "store did not render remote petpacks", fetchCalls, storeText }));
    process.exit(1);
  }

  const updateButton = findByText(elements.get("#petStoreList"), "Update");
  if (!updateButton) {
    console.error(JSON.stringify({ ok: false, reason: "missing update button", storeText }));
    process.exit(1);
  }
  updateButton.click();
  await flush();

  const statusText = elements.get("#petStoreStatus").textContent;
  if (!fetchCalls.some((url) => url.endsWith("/petpacks/mi-fen-1.0.2.petpack")) || inspectCalls.length !== 1 || importCalls.length !== 1 || !statusText.includes("Updated Mi Fen")) {
    console.error(JSON.stringify({ ok: false, reason: "store did not download and import petpack", fetchCalls, inspectCalls: inspectCalls.length, importCalls: importCalls.length, statusText }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, storeText, statusText }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
