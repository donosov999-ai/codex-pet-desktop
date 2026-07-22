const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer } = require("./renderer-smoke-harness");

const CELL_HEIGHT = 208;

function transformedPetTop(windowHeight, scale) {
  const css = fs.readFileSync(path.join(__dirname, "app", "renderer.css"), "utf8");
  const origin = css.match(/#pet\s*\{[\s\S]*?transform-origin:\s*([^;]+);/)?.[1]?.trim() || "center center";
  const originY = /\bbottom\b/.test(origin) ? 1 : 0.5;
  const layoutTop = (windowHeight - CELL_HEIGHT) / 2;
  return layoutTop + CELL_HEIGHT * originY - CELL_HEIGHT * scale * originY;
}

async function main() {
  const resizeCalls = [];
  const centerCalls = [];
  const pet = {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };

  const { elements, flush } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.8", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ scale: 0.6, autoWander: false }),
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
      resizeWindow: async (width, height, anchor) => {
        resizeCalls.push({ width, height, anchor });
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

  const initialPetWindow = resizeCalls.at(-1);
  if (!initialPetWindow || initialPetWindow.width > 240 || initialPetWindow.height > 260) {
    console.error(JSON.stringify({ ok: false, reason: "pet-only window was not compact", resizeCalls }, null, 2));
    process.exit(1);
  }

  elements.get("#scaleRange").value = "1.8";
  elements.get("#scaleRange").dispatch("input");
  await flush();
  const largePetWindow = resizeCalls.at(-1);
  if (!largePetWindow || largePetWindow.width <= initialPetWindow.width || largePetWindow.height <= initialPetWindow.height) {
    console.error(JSON.stringify({ ok: false, reason: "window did not grow with pet scale", resizeCalls }, null, 2));
    process.exit(1);
  }
  const largePetTop = transformedPetTop(largePetWindow.height, 1.8);
  if (largePetTop < 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "scaled pet is clipped above the transparent window",
          scale: 1.8,
          top: largePetTop,
          window: largePetWindow
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  const expectedCurrentBottom = initialPetWindow.height / 2 + (CELL_HEIGHT * 0.6) / 2;
  const expectedNextBottom = largePetWindow.height / 2 + (CELL_HEIGHT * 1.8) / 2;
  if (
    Math.abs(largePetWindow.anchor?.current?.y - expectedCurrentBottom) > 0.01 ||
    Math.abs(largePetWindow.anchor?.next?.y - expectedNextBottom) > 0.01
  ) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "resize anchor does not preserve the scaled pet baseline",
          anchor: largePetWindow.anchor,
          expectedCurrentBottom,
          expectedNextBottom
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  elements.get("#openStoreButton").click();
  await flush();
  const panelWindow = resizeCalls.at(-1);
  if (!panelWindow || panelWindow.width < 340 || panelWindow.height < 420) {
    console.error(JSON.stringify({ ok: false, reason: "panel window was not expanded", resizeCalls }, null, 2));
    process.exit(1);
  }

  if (centerCalls.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "active pet layout should not recenter window", centerCalls }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, resizeCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
