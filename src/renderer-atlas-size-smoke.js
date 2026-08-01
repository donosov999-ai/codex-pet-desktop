const { loadRenderer } = require("./renderer-smoke-harness");

// A pack can declare spriteVersionNumber 1 while shipping an 11-row atlas. Trusting the number
// drew the sheet 1872px tall instead of 2288: rows drifted and a slice of the next row leaked in
// below the sprite, so the pet looked cut in two. The renderer must measure the image instead.
const PET_VERSION = "1.0.3";
const SPRITESHEET = "/pets/biruzik/spritesheet.webp";
// Outside Tauri the renderer serves the sheet by url and tags it with the pack revision.
const SPRITESHEET_URL = `${SPRITESHEET}?spriteRevision=${PET_VERSION}`;
const REAL_ATLAS_WIDTH = 1536;
const REAL_ATLAS_HEIGHT = 2288;

async function main() {
  const pet = {
    id: "biruzik",
    displayName: "Biruzik",
    version: PET_VERSION,
    sourceKind: "managed",
    canUninstall: true,
    spriteVersionNumber: 1,
    spritesheetUrl: SPRITESHEET
  };
  const { elements, flush } = await loadRenderer({
    imageSizes: { [SPRITESHEET_URL]: [REAL_ATLAS_WIDTH, REAL_ATLAS_HEIGHT] },
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.33", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({
        selectedPetId: "biruzik",
        scale: 0.9,
        autoWander: false,
        alwaysOnTop: true,
        petDirection: "right"
      }),
      savePreferences: async (preferences) => preferences,
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
      resizeWindow: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      centerPosition: async () => {},
      quit: () => {}
    }
  });

  await flush();

  const backgroundSize = elements.get("#pet").style.backgroundSize;
  const expected = `${REAL_ATLAS_WIDTH}px ${REAL_ATLAS_HEIGHT}px`;
  if (backgroundSize !== expected) {
    throw new Error(`expected background size ${expected}, got ${backgroundSize}`);
  }

  console.log(JSON.stringify({ ok: true, backgroundSize }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
