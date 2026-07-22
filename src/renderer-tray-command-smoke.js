const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const listeners = {};
  const fetchCalls = [];
  const pet = {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        json: async () => [
          {
            id: "mi-fen",
            displayName: "Mi Fen",
            version: "1.0.2",
            fileName: "mi-fen-1.0.2.petpack"
          }
        ]
      };
    },
    tauri: {
      event: {
        listen: async (name, handler) => {
          listeners[name] = handler;
          return () => {};
        }
      }
    },
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.2",
        latestReleaseApi: "",
        downloadsUrl: "https://donosov999-ai.github.io/codex-pet-desktop/",
        petpackIndexUrl: "https://donosov999-ai.github.io/codex-pet-desktop/petpacks/petpacks.json"
      }),
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

  const listener = listeners["pet-desktop-tray-command"];
  if (!listener) {
    console.error(JSON.stringify({ ok: false, reason: "renderer did not register tray command listener", listeners: Object.keys(listeners) }));
    process.exit(1);
  }

  await listener({ payload: { command: "pause_wander" } });
  await flush();
  if (elements.get("#wanderToggle").checked || !elements.get("#petStatus").textContent.includes("Automatic wandering paused")) {
    console.error(JSON.stringify({ ok: false, reason: "pause command did not update wander state", checked: elements.get("#wanderToggle").checked, status: elements.get("#petStatus").textContent }));
    process.exit(1);
  }

  await listener({ payload: { command: "resume_wander" } });
  await flush();
  if (!elements.get("#wanderToggle").checked || !elements.get("#petStatus").textContent.includes("Automatic wandering resumed")) {
    console.error(JSON.stringify({ ok: false, reason: "resume command did not update wander state", checked: elements.get("#wanderToggle").checked, status: elements.get("#petStatus").textContent }));
    process.exit(1);
  }

  await listener({ payload: { command: "open_store" } });
  await flush();
  if (elements.get("#panel").classList.contains("hidden") || !fetchCalls[0]?.endsWith("/petpacks/petpacks.json")) {
    console.error(JSON.stringify({ ok: false, reason: "open store command did not show panel and refresh store", panelHidden: elements.get("#panel").classList.contains("hidden"), fetchCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, fetchCalls, status: elements.get("#petStatus").textContent }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
