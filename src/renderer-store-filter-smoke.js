const { findByText, loadRenderer, textOf } = require("./renderer-smoke-harness");

function findButtonByText(element, text) {
  if (element.selector === "button" && element.textContent === text) {
    return element;
  }
  for (const child of element.children || []) {
    const found = findButtonByText(child, text);
    if (found) {
      return found;
    }
  }
  return null;
}

async function main() {
  const fetchCalls = [];
  const localPets = [
    {
      id: "mi-fen",
      displayName: "米粉",
      version: "1.0.1",
      sourceKind: "managed",
      canUninstall: true,
      spritesheetPath: "/pets/mi-fen/spritesheet.webp"
    },
    {
      id: "mi-jiu",
      displayName: "米酒",
      version: "1.0.0",
      sourceKind: "managed",
      canUninstall: true,
      spritesheetPath: "/pets/mi-jiu/spritesheet.webp"
    }
  ];

  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).endsWith(".petpack")) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        json: async () => [
          {
            id: "mi-fen",
            displayName: "米粉",
            description: "全白猫咪",
            version: "1.0.2",
            sizeBytes: 2048,
            updatedAt: "2026-05-17",
            fileName: "mi-fen-1.0.2.petpack"
          },
          {
            id: "mi-jiu",
            displayName: "米酒",
            description: "深色猫咪",
            version: "1.0.0",
            sizeBytes: 1024,
            updatedAt: "2026-05-16",
            fileName: "mi-jiu-1.0.0.petpack"
          },
          {
            id: "hong-tang",
            displayName: "红糖",
            description: "惠比特",
            version: "1.0.1",
            sizeBytes: 4096,
            updatedAt: "2026-05-15",
            fileName: "hong-tang-1.0.1.petpack"
          }
        ]
      };
    },
    petDesktop: {
      listPets: async () => ({ pets: localPets, errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.3",
        latestReleaseApi: "",
        downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
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

  elements.get("#refreshStoreButton").click();
  await flush();
  let storeText = textOf(elements.get("#petStoreList"));
  if (!storeText.includes("2 KB") || !storeText.includes("2026-05-17")) {
    console.error(JSON.stringify({ ok: false, reason: "store details missing", storeText }));
    process.exit(1);
  }

  elements.get("#storeFilter").value = "updates";
  elements.get("#storeFilter").dispatch("change");
  await flush();
  storeText = textOf(elements.get("#petStoreList"));
  if (!storeText.includes("米粉") || storeText.includes("米酒") || storeText.includes("红糖")) {
    console.error(JSON.stringify({ ok: false, reason: "updates filter failed", storeText }));
    process.exit(1);
  }

  elements.get("#storeFilter").value = "uninstalled";
  elements.get("#storeFilter").dispatch("change");
  await flush();
  storeText = textOf(elements.get("#petStoreList"));
  if (!storeText.includes("红糖") || storeText.includes("米粉") || storeText.includes("米酒")) {
    console.error(JSON.stringify({ ok: false, reason: "uninstalled filter failed", storeText }));
    process.exit(1);
  }

  const installButton = findButtonByText(elements.get("#petStoreList"), "安装") || findByText(elements.get("#petStoreList"), "安装");
  installButton.click();
  await flush();
  const statusText = elements.get("#petStoreStatus").textContent;
  if (!statusText.includes("安装失败") || !statusText.includes("打开下载页")) {
    console.error(JSON.stringify({ ok: false, reason: "store failure did not show fallback", statusText, fetchCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, storeText, statusText }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
