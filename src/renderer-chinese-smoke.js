const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer, textOf } = require("./renderer-smoke-harness");

async function main() {
  const { elements } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.2",
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
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
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
    "还没有宠物",
    "导入宠物包",
    "宠物",
    "动作",
    "大小",
    "自动散步",
    "自然生命节奏",
    "保持置顶",
    "更新",
    "资源库",
    "导入本地宠物包",
    "已安装宠物",
    "退出",
    "待机"
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
    console.error(JSON.stringify({ ok: false, reason: "renderer text is not fully localized", missing, englishLeaks, pageText }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checked: expected.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
