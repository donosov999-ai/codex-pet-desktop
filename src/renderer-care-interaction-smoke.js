const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const moveCalls = [];
  const resizeCalls = [];
  const pet = {
    id: "biruzik",
    displayName: "Бирюзик",
    version: "1.0.0",
    spritesheetUrl: "biruzik-standard.webp",
    behavior: {
      doubleClickState: "jumping",
      idleStates: ["idle"],
      wanderDirections: [1],
      natural: {
        nextWanderDelayMs: [1, 1],
        walkDurationMs: [5000, 5000]
      }
    },
    care: {
      spritesheetUrl: "biruzik-care.webp",
      atlas: {
        width: 1536,
        height: 1040,
        columns: 8,
        rows: 5,
        cellWidth: 192,
        cellHeight: 208
      },
      states: {
        sleep: { label: "Сон", row: 0, frames: 6, fps: 3, durationMs: 9000 },
        eat: { label: "Еда", row: 1, frames: 6, fps: 5, durationMs: 6500 },
        wash: { label: "Мытьё", row: 2, frames: 6, fps: 5, durationMs: 6500 },
        play: { label: "Игра", row: 3, frames: 6, fps: 7, durationMs: 5000 },
        toilet: { label: "Туалет", row: 4, frames: 6, fps: 4, durationMs: 5500 }
      }
    }
  };

  const { animationFrames, elements, flush, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.29", platform: "windows" }),
      getPreferences: async () => ({ scale: 0.9, autoWander: true, naturalLife: true }),
      savePreferences: async (value) => value,
      moveBy: async (x, y) => {
        moveCalls.push([x, y]);
        return { hitEdge: "" };
      },
      resizeWindow: async (width, height, anchor) => {
        resizeCalls.push({ width, height, anchor });
      },
      setIgnoreMouseEvents: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  const petElement = elements.get("#pet");
  const careActions = elements.get("#careActions");
  if (careActions.children.length !== 5) {
    throw new Error(`expected 5 care actions, found ${careActions.children.length}`);
  }

  petElement.dispatch("pointerenter");
  timeouts.at(-1)?.();
  for (const frame of [...animationFrames]) {
    frame(1000);
  }
  await flush();
  if (moveCalls.length !== 0) {
    throw new Error("hover must pause autonomous movement");
  }

  petElement.dispatch("dblclick");
  await flush();
  if (elements.get("#panel").classList.contains("hidden")) {
    throw new Error("double click must open care controls");
  }
  const expanded = resizeCalls.at(-1);
  if (!expanded || expanded.width < 520 || expanded.height < 440) {
    throw new Error(`care panel did not expand the window: ${JSON.stringify(expanded)}`);
  }

  careActions.children.find((button) => button.dataset.careState === "eat")?.click();
  if (elements.get("#stateSelect").value !== "eat") {
    throw new Error("care action did not switch to eat state");
  }

  console.log(JSON.stringify({ ok: true, careActions: careActions.children.length, expanded }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
