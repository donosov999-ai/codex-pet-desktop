const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer, textOf } = require("./renderer-smoke-harness");

async function main() {
  const { elements } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.30",
        latestReleaseApi: "",
        downloadsUrl: "https://donosov999-ai.github.io/codex-pet-desktop/",
        petpackIndexUrl: ""
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
      resizeWindow: async () => {},
      centerPosition: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  const htmlText = fs.readFileSync(path.join(__dirname, "app", "renderer.html"), "utf8");
  const runtimeText = [
    textOf(elements.get("#emptyState")),
    textOf(elements.get("#panel")),
    textOf(elements.get("#stateSelect")),
    textOf(elements.get("#petManager"))
  ].join(" ");
  const pageText = `${htmlText} ${runtimeText}`;

  const expected = [
    "No pet found",
    "Import pack",
    "Pet",
    "Action",
    "Size",
    "Wander across the screen",
    "Autonomous actions",
    "Always on top",
    "Updates",
    "Catalog",
    "Import pet pack",
    "Installed pets",
    "Quit Biruzik",
    "Idle"
  ];
  const missing = expected.filter((text) => !pageText.includes(text));
  const nonEnglishText = pageText.match(/[\u0400-\u04ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu) || [];

  if (missing.length || nonEnglishText.length) {
    console.error(JSON.stringify({ ok: false, reason: "renderer text is not English-only", missing, nonEnglishText }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checked: expected.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
