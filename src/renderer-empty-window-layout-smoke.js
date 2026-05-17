const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const resizeCalls = [];
  const centerCalls = [];

  await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.8", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ scale: 0.6, autoWander: true }),
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
      resizeWindow: async (width, height) => {
        resizeCalls.push({ width, height });
      },
      centerPosition: async () => {
        centerCalls.push(true);
      },
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  const last = resizeCalls.at(-1);
  if (!last || last.width < 340 || last.height < 420 || centerCalls.length < 1) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "empty first-run layout was not expanded and centered",
          resizeCalls,
          centerCalls
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, resizeCalls, centerCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
