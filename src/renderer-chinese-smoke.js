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
        downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
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
    "Питомец не найден",
    "Импортировать пакет",
    "Питомец",
    "Действие",
    "Размер",
    "Гулять по экрану",
    "Самостоятельные действия",
    "Поверх остальных окон",
    "Обновления",
    "Каталог",
    "Импортировать пакет питомца",
    "Установленные питомцы",
    "Закрыть Бирюзика",
    "Спокойно"
  ];
  const missing = expected.filter((text) => !pageText.includes(text));
  const englishLeaks = [
    "Import Petpack",
    "No pet installed",
    "Auto wander",
    "Always on top",
    "Open Downloads",
    "Installed pets",
    "Quit"
  ].filter((text) => pageText.includes(text));

  if (missing.length || englishLeaks.length) {
    console.error(JSON.stringify({ ok: false, reason: "renderer text is not fully localized", missing, englishLeaks }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checked: expected.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
