const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const listeners = {};
  let resolveDownload;
  const downloadCalls = [];
  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      if (String(url).includes("/releases/latest")) {
        return {
          ok: true,
          json: async () => ({
            tag_name: "v0.2.17",
            assets: [
              {
                name: "yongsheng-plan-windows-x64.exe",
                size: 4096,
                browser_download_url:
                  "https://github.com/jieyangxchen/codex-pet-desktop/releases/download/v0.2.17/yongsheng-plan-windows-x64.exe"
              }
            ]
          })
        };
      }
      throw new Error(`unexpected fetch ${url}`);
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
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.16",
        platform: "windows",
        latestReleaseApi: "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest",
        downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
        petpackIndexUrl: ""
      }),
      downloadAndInstallAppUpdate: async (url, fileName) => {
        downloadCalls.push({ url, fileName });
        return new Promise((resolve) => {
          resolveDownload = resolve;
        });
      },
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resizeWindow: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  elements.get("#checkUpdateButton").click();
  await flush();

  const listener = listeners["pet-desktop-app-update-download-progress"];
  if (!listener) {
    console.error(JSON.stringify({ ok: false, reason: "missing app update progress listener", listeners: Object.keys(listeners) }));
    process.exit(1);
  }

  const progressEl = elements.get("#appUpdateProgress");
  let updateText = elements.get("#updateStatus").textContent;
  if (
    downloadCalls[0]?.fileName !== "yongsheng-plan-windows-x64.exe" ||
    !updateText.includes("正在下载主程序安装包") ||
    progressEl.classList.contains("hidden") ||
    progressEl.max !== 4096 ||
    progressEl.value !== 0
  ) {
    console.error(JSON.stringify({ ok: false, reason: "download did not start with clear progress state", updateText, progressEl, downloadCalls }));
    process.exit(1);
  }

  await listener({
    payload: {
      fileName: "yongsheng-plan-windows-x64.exe",
      received: 1024,
      total: 4096
    }
  });
  await flush();

  updateText = elements.get("#updateStatus").textContent;
  if (progressEl.max !== 4096 || progressEl.value !== 1024 || !updateText.includes("1 KB / 4 KB")) {
    console.error(JSON.stringify({ ok: false, reason: "download progress event did not update progress UI", updateText, progressEl }));
    process.exit(1);
  }

  resolveDownload();
  await flush();

  if (!elements.get("#updateStatus").textContent.includes("已启动安装器") || !progressEl.classList.contains("hidden")) {
    console.error(JSON.stringify({ ok: false, reason: "download completion did not reset progress UI", updateText: elements.get("#updateStatus").textContent, progressEl }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, updateText: elements.get("#updateStatus").textContent, downloadCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
