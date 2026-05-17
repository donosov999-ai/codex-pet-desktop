const { loadRenderer, textOf } = require("./renderer-smoke-harness");

async function main() {
  const fetchCalls = [];
  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        json: async () => [
          {
            id: "mi-fen",
            displayName: "米粉",
            description: "全白猫咪",
            version: "1.0.2",
            fileName: "mi-fen-1.0.2.petpack",
            previewAtlas: "previews/mi-fen-1.0.2-atlas.webp"
          }
        ]
      };
    },
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.3",
        latestReleaseApi: "",
        petpackIndexUrl: "https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json"
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
  await flush();

  const storeText = textOf(elements.get("#petStoreList"));
  if (
    elements.get("#panel").classList.contains("hidden") ||
    !fetchCalls[0]?.endsWith("/petpacks/petpacks.json") ||
    !storeText.includes("米粉") ||
    !storeText.includes("安装")
  ) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "first run did not open the pet store",
        panelHidden: elements.get("#panel").classList.contains("hidden"),
        fetchCalls,
        storeText
      })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, fetchCalls, storeText }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
