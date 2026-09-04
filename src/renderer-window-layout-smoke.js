const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer } = require("./renderer-smoke-harness");

const CELL_HEIGHT = 208;

function transformedPetTop(windowHeight, scale) {
  const css = fs.readFileSync(path.join(__dirname, "app", "renderer.css"), "utf8");
  const origin = css.match(/#pet\s*\{[\s\S]*?transform-origin:\s*([^;]+);/)?.[1]?.trim() || "center center";
  const originY = /\bbottom\b/.test(origin) ? 1 : 0.5;
  // The box is anchored to the bottom of #stage, not centred: its bottom edge sits FLOOR_GAP
  // above the frame. This used to read (windowHeight - CELL_HEIGHT) / 2, which described the old
  // centred layout and, together with a bottom-origin scale, is what let the head leave the
  // window unnoticed at large sizes.
  const layoutTop = windowHeight - FLOOR_GAP - CELL_HEIGHT;
  return layoutTop + CELL_HEIGHT * originY - CELL_HEIGHT * scale * originY;
}

// The pet is drawn at the slider scale MULTIPLIED by how much it has grown from care, so the
// window has to fit that product. Reading the factor from the app instead of hardcoding it keeps
// this check honest when the growth curve is tuned.
// The drawn scale is the slider, full stop. This used to multiply by growthFactor(0)
// = 0.7 because care made the sprite bigger; that model is gone (growth-layer.js).
const { FLOOR_GAP } = require("./app/renderer/window-layout.js");

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
  // The baseline the shell holds still is the pet's feet, and with the bottom anchor that is the
  // frame minus the floor gap — the same at every scale, which is the point of a baseline.
  const expectedCurrentBottom = initialPetWindow.height - FLOOR_GAP;
  const expectedNextBottom = largePetWindow.height - FLOOR_GAP;
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
