const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer } = require("./renderer-smoke-harness");

function visible(element) {
  return !element.classList.contains("hidden");
}

async function main() {
  const html = fs.readFileSync(path.join(__dirname, "app", "renderer.html"), "utf8");
  const requiredIds = [
    "tabControl",
    "tabStore",
    "tabManager",
    "tabUpdate",
    "controlSection",
    "storeSection",
    "managerSection",
    "updateSection"
  ];
  const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
  if (missingIds.length) {
    console.error(JSON.stringify({ ok: false, reason: "panel tabs missing from HTML", missingIds }, null, 2));
    process.exit(1);
  }

  const { elements, flush } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({
        pets: [
          {
            id: "mi-fen",
            displayName: "Mi Fen",
            version: "1.0.2",
            sourceKind: "managed",
            canUninstall: true,
            spritesheetPath: "/pets/mi-fen/spritesheet.webp"
          }
        ],
        errors: []
      }),
      getAppInfo: async () => ({ version: "0.2.4", latestReleaseApi: "", petpackIndexUrl: "" }),
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
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  elements.get("#tabStore").click();
  await flush();
  if (!visible(elements.get("#storeSection")) || visible(elements.get("#controlSection"))) {
    console.error(JSON.stringify({ ok: false, reason: "store tab did not activate" }, null, 2));
    process.exit(1);
  }

  elements.get("#tabManager").click();
  await flush();
  if (!visible(elements.get("#managerSection")) || visible(elements.get("#storeSection"))) {
    console.error(JSON.stringify({ ok: false, reason: "manager tab did not activate" }, null, 2));
    process.exit(1);
  }

  elements.get("#openStoreButton").click();
  await flush();
  if (!visible(elements.get("#storeSection"))) {
    console.error(JSON.stringify({ ok: false, reason: "open store did not switch to store tab" }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
