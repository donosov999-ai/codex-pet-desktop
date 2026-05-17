const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const pet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    behavior: {
      idleStates: ["review"],
      wanderDirections: [0],
      natural: {
        nextWanderDelayMs: [420, 420],
        idleDurationMs: [900, 900],
        postDragState: "review",
        postDragMs: 180
      }
    }
  };
  const randomValues = [0, 0, 0, 0.9, 0.1];
  const { elements, timeouts } = await loadRenderer({
    random: () => randomValues.shift() ?? 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.3", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ autoWander: true }),
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
      resizeWindow: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  if (timeouts.at(-1)?.delay !== 420) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "natural nextWanderDelayMs was ignored",
        delay: timeouts.at(-1)?.delay
      })
    );
    process.exit(1);
  }

  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "review") {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "idle natural behavior did not choose a quiet action",
        state: elements.get("#stateSelect").value
      })
    );
    process.exit(1);
  }

  elements.get("#pet").dispatch("pointerdown", {
    button: 0,
    pointerId: 1,
    screenX: 100,
    screenY: 100
  });
  elements.get("#pet").dispatch("pointermove", {
    pointerId: 1,
    screenX: 122,
    screenY: 109
  });
  elements.get("#pet").dispatch("pointerup", {
    pointerId: 1,
    screenX: 122,
    screenY: 109
  });
  if (elements.get("#stateSelect").value !== "review" || timeouts.at(-1)?.delay !== 180) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "post-drag natural feedback was not applied",
        state: elements.get("#stateSelect").value,
        delay: timeouts.at(-1)?.delay
      })
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        state: elements.get("#stateSelect").value,
        delays: timeouts.map((timeout) => timeout.delay)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
