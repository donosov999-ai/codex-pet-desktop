const { loadRenderer, waitFor } = require("./renderer-smoke-harness");

function createPetDesktop({ pet, moveCalls = [], preferences }) {
  return {
    listPets: async () => ({ pets: [pet], errors: [] }),
    getAppInfo: async () => ({ version: "0.3.0", latestReleaseApi: "", petpackIndexUrl: "" }),
    getPreferences: async () => preferences,
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
    moveBy: async (x, y) => {
      moveCalls.push([x, y]);
      return { hitEdge: "" };
    },
    setIgnoreMouseEvents: async () => {},
    resizeWindow: async () => {},
    resetPosition: async () => {},
    setAlwaysOnTop: async () => {},
    getWindowState: async () => ({ alwaysOnTop: true }),
    updateTrayState: async () => {},
    quit: () => {}
  };
}

function lifePet() {
  return {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.1.0",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    behavior: {
      clickState: "waving",
      idleStates: ["idle"],
      wanderDirections: [0],
      natural: {
        nextWanderDelayMs: [400, 400],
        idleDurationMs: [900, 900],
        walkDurationMs: [900, 900],
        clickReturnState: "idle"
      },
      life: {
        phases: [
          {
            id: "test-phase",
            from: 0,
            to: 24,
            idleStates: ["review"],
            wanderDirections: [1],
            nextWanderDelayMs: [250, 250],
            idleDurationMs: [800, 800],
            walkDurationMs: [1200, 1200]
          }
        ]
      }
    }
  };
}

async function advanceOnceAnimation(animationFrames) {
  let frame = animationFrames[0];
  for (let index = 0; index < 5; index += 1) {
    frame?.(index * 250);
    frame = animationFrames.at(-1);
  }
}

async function assertNaturalLifeUsesPhasePlan() {
  const moveCalls = [];
  const { animationFrames, elements, flush, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: createPetDesktop({
      pet: lifePet(),
      moveCalls,
      preferences: { autoWander: true, naturalLife: true }
    })
  });

  await waitFor(() => timeouts.length > 0);
  if (timeouts.at(-1)?.delay !== 250) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "naturalLife phase nextWanderDelayMs was not used",
        delay: timeouts.at(-1)?.delay
      })
    );
    process.exit(1);
  }

  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "running-right") {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "naturalLife autonomous phase plan was not applied",
        state: elements.get("#stateSelect").value
      })
    );
    process.exit(1);
  }

  animationFrames[1]?.(100);
  await flush();
  if (moveCalls.length !== 1 || moveCalls[0][0] <= 0) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "wanderLoop did not move according to the phase plan",
        moveCalls
      })
    );
    process.exit(1);
  }

  elements.get("#pet").click();
  await advanceOnceAnimation(animationFrames);
  if (elements.get("#stateSelect").value !== "review") {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "click did not return to the phase-aware interaction state",
        state: elements.get("#stateSelect").value
      })
    );
    process.exit(1);
  }
}

async function assertLegacyDelayWhenNaturalLifeDisabled() {
  const { timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: createPetDesktop({
      pet: lifePet(),
      preferences: { autoWander: true, naturalLife: false }
    })
  });

  await waitFor(() => timeouts.length > 0);
  if (timeouts.at(-1)?.delay !== 400) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "legacy natural nextWanderDelayMs was not preserved",
        delay: timeouts.at(-1)?.delay
      })
    );
    process.exit(1);
  }
}

async function assertLegacyDragFeedbackKeepsDefaultOnceReturn() {
  const pet = lifePet();
  pet.behavior.natural.postDragState = "jumping";
  pet.behavior.natural.postDragMs = 333;
  const { animationFrames, elements, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: createPetDesktop({
      pet,
      preferences: { autoWander: true, naturalLife: false }
    })
  });

  elements.get("#pet").dispatch("pointerdown", {
    button: 0,
    pointerId: 1,
    screenX: 100,
    screenY: 100
  });
  elements.get("#pet").dispatch("pointermove", {
    pointerId: 1,
    screenX: 116,
    screenY: 100
  });
  elements.get("#pet").dispatch("pointerup", {
    pointerId: 1,
    screenX: 116,
    screenY: 100
  });

  await waitFor(() => elements.get("#stateSelect").value === "jumping" && timeouts.length > 0);
  if (elements.get("#stateSelect").value !== "jumping" || timeouts.at(-1)?.delay !== 333) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "legacy drag feedback did not use manifest postDragState/postDragMs",
        state: elements.get("#stateSelect").value,
        delay: timeouts.at(-1)?.delay
      })
    );
    process.exit(1);
  }

  await advanceOnceAnimation(animationFrames);
  if (elements.get("#stateSelect").value !== "idle") {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "legacy drag feedback changed the default once return state",
        state: elements.get("#stateSelect").value
      })
    );
    process.exit(1);
  }
}

async function assertAutoWanderGateKeepsClickActive() {
  const moveCalls = [];
  const { elements, flush, timeouts } = await loadRenderer({
    random: () => 0,
    petDesktop: createPetDesktop({
      pet: lifePet(),
      moveCalls,
      preferences: { autoWander: false, naturalLife: true }
    })
  });

  // Wait for the renderer to have a pet AND to have scheduled its tick. Waiting on the state
  // alone was not enough: probing the failing runs showed the timeout list still EMPTY at this
  // point, so firing "the last timeout" fired nothing, the pet was never driven, and the click
  // below reported "click was blocked" — a diagnosis of something that had not happened.
  // Wait for the renderer to be genuinely ready: a state chosen, its tick scheduled, and the
  // state LIST populated. The last one is what kept failing. Probing the bad runs showed the
  // timeout list empty at this point on some, and on others the click set a state the select did
  // not yet contain, so its value fell back to "" — reported as "click was blocked", which is a
  // diagnosis of something that never happened. The click state of this fixture is "waving".
  await waitFor(() =>
    elements.get("#stateSelect").value !== "" &&
    timeouts.length > 0 &&
    (elements.get("#stateSelect").children || []).length > 0
  );
  timeouts.at(-1)?.();
  await flush();
  if (elements.get("#stateSelect").value === "running-right" || moveCalls.length) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "autoWander=false did not gate autonomous movement",
        state: elements.get("#stateSelect").value,
        moveCalls
      })
    );
    process.exit(1);
  }

  // The click is retried, not fired once. What is being asserted is that autoWander=false does
  // not BLOCK a direct click — not that the click handler happens to be bound by the sixth flush.
  // Binding order here is not deterministic, and a click landing before it produced state "",
  // which the message below then reported as a blocked click: a diagnosis of something that had
  // not happened. A click that is genuinely blocked never succeeds however often it is retried,
  // so the assertion keeps its teeth.
  await waitFor(() => {
    elements.get("#pet").click();
    return elements.get("#stateSelect").value === "waving";
  });
  if (elements.get("#stateSelect").value !== "waving") {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "autoWander=false incorrectly blocked direct click interaction",
        state: elements.get("#stateSelect").value
      })
    );
    process.exit(1);
  }
}

async function main() {
  await assertNaturalLifeUsesPhasePlan();
  await assertLegacyDelayWhenNaturalLifeDisabled();
  await assertLegacyDragFeedbackKeepsDefaultOnceReturn();
  await assertAutoWanderGateKeepsClickActive();
  console.log(JSON.stringify({ ok: true }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
