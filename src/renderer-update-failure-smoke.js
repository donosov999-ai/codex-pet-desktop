const { loadRenderer } = require("./renderer-smoke-harness");

async function latestFetchFailureScenario() {
  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      if (String(url).includes("/releases/latest")) {
        throw new Error("Failed to fetch");
      }
      throw new Error(`unexpected fetch ${url}`);
    },
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.14",
        platform: "windows",
        latestReleaseApi: "https://api.github.com/repos/donosov999-ai/codex-pet-desktop/releases/latest",
        downloadsUrl: "https://donosov999-ai.github.io/codex-pet-desktop/",
        petpackIndexUrl: ""
      }),
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

  const text = elements.get("#updateStatus").textContent;
  if (!text.includes("Failed to check the app version") || !text.includes("Failed to fetch")) {
    console.error(JSON.stringify({ ok: false, reason: "latest fetch failure text was not specific", text }));
    process.exit(1);
  }
}

async function installerDownloadFailureScenario() {
  const downloadCalls = [];
  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      if (String(url).includes("/releases/latest")) {
        return {
          ok: true,
          json: async () => ({
            tag_name: "v0.2.15",
            assets: [
              {
                name: "biruzik-desktop-windows-x64.exe",
                browser_download_url:
                  "https://github.com/donosov999-ai/codex-pet-desktop/releases/download/v0.2.15/biruzik-desktop-windows-x64.exe"
              }
            ]
          })
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    },
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.14",
        platform: "windows",
        latestReleaseApi: "https://api.github.com/repos/donosov999-ai/codex-pet-desktop/releases/latest",
        downloadsUrl: "https://donosov999-ai.github.io/codex-pet-desktop/",
        petpackIndexUrl: ""
      }),
      downloadAndInstallAppUpdate: async (url, fileName) => {
        downloadCalls.push({ url, fileName });
        throw "HTTP 503";
      },
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

  const text = elements.get("#updateStatus").textContent;
  if (
    downloadCalls[0]?.fileName !== "biruzik-desktop-windows-x64.exe" ||
    !text.includes("Failed to download or launch the app installer") ||
    !text.includes("HTTP 503")
  ) {
    console.error(JSON.stringify({ ok: false, reason: "installer failure text was not specific", text, downloadCalls }));
    process.exit(1);
  }
}

async function main() {
  await latestFetchFailureScenario();
  await installerDownloadFailureScenario();
  console.log(JSON.stringify({ ok: true }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
