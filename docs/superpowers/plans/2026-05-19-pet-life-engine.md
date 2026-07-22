# Pet Life Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight session-only life engine so desktop pets follow an accelerated daily rhythm, respond clearly to direct interaction, and perform medium-intensity idle reactions.

**Architecture:** Keep the engine pure and renderer-side in `src/app/renderer/life-engine.js`. `interactions.js` continues to own DOM, pointer events, animation calls, timers, and Tauri window movement, but asks the life engine for phase-aware behavior plans when `naturalLife` is enabled. Preferences persist the new default-on `naturalLife` toggle, while old pet manifests and old preference files keep working.

**Tech Stack:** Tauri 2, Rust preferences module, vanilla ES modules in the renderer, Node smoke tests.

---

## File Structure

- Create `src/app/renderer/life-engine.js`: pure behavior planner, no DOM and no Tauri calls.
- Create `src/renderer-life-engine-smoke.mjs`: pure module smoke test for pet-time scaling, phases, interactions, idle plans, and gating.
- Modify `src/app/renderer/interactions.js`: integrate life-engine plans while retaining legacy random wander when `naturalLife` is off.
- Modify `src/app/renderer/index.js`: include `naturalLife` in state, current preferences, apply/save flow, and event binding.
- Modify `src/app/renderer.html`: add a compact English toggle near `Automatic wandering`.
- Modify `src/app/renderer/dom.js`: expose `naturalLifeToggle`.
- Modify `src/renderer-smoke-harness.js`: add `#naturalLifeToggle` to fake DOM and default it checked.
- Modify `src/renderer-settings-smoke.js`: verify loading and saving `naturalLife`.
- Modify `src/renderer-natural-behavior-smoke.js`: verify phase-aware behavior preserves manifest natural timings.
- Add `src/renderer-life-integration-smoke.js`: verify `naturalLife: false` keeps legacy wander behavior and `autoWander: false` suppresses autonomous movement.
- Modify `src/renderer-english-smoke.js`: include the new English UI label.
- Modify `src-tauri/src/preferences.rs`: persist `natural_life: bool` with default `true` and old-file fallback.
- Modify `package.json`: add the two new smoke tests to `npm run smoke`.

## Task 1: Pure Life Engine

**Files:**
- Create: `src/app/renderer/life-engine.js`
- Create: `src/renderer-life-engine-smoke.mjs`

- [ ] **Step 1: Write the failing pure smoke test**

Create `src/renderer-life-engine-smoke.mjs`:

```js
import {
  PET_TIME_SCALE,
  createLifeEngine,
  petHourAt,
  phaseForPetHour
} from "./app/renderer/life-engine.js";

function assert(condition, detail) {
  if (!condition) {
    console.error(JSON.stringify({ ok: false, ...detail }, null, 2));
    process.exit(1);
  }
}

const hour = 60 * 60 * 1000;
assert(PET_TIME_SCALE === 10, { reason: "pet time scale changed", PET_TIME_SCALE });
assert(petHourAt({ nowMs: hour, startedAtMs: 0, startPetHour: 8 }) === 18, {
  reason: "1 real hour should advance 10 pet hours"
});
assert(phaseForPetHour(8).id === "wake", { reason: "8:00 should be wake phase" });
assert(phaseForPetHour(13).id === "active", { reason: "13:00 should be active phase" });
assert(phaseForPetHour(20).id === "quiet", { reason: "20:00 should be quiet phase" });
assert(phaseForPetHour(2).id === "sleepy", { reason: "02:00 should be sleepy phase" });

const behavior = {
  clickState: "waiting",
  doubleClickState: "jumping",
  idleStates: ["review"],
  wanderDirections: [0],
  natural: {
    nextWanderDelayMs: [500, 500],
    idleDurationMs: [700, 700],
    walkDurationMs: [900, 900],
    postDragState: "review",
    postDragMs: 300,
    clickReturnState: "waiting",
    doubleClickReturnState: "idle"
  },
  life: {
    phases: [
      {
        id: "wake",
        from: 6,
        to: 10,
        idleStates: ["waiting"],
        wanderDirections: [0],
        nextWanderDelayMs: [500, 500],
        idleDurationMs: [700, 700],
        walkDurationMs: [900, 900]
      }
    ],
    idleReactionDelayMs: [1200, 1200]
  }
};

const engine = createLifeEngine({
  behavior,
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 8,
  now: () => 0,
  random: () => 0
});

const click = engine.planInteraction("click");
assert(click.state === "waiting" && click.onceReturn === "waiting", {
  reason: "click should use manifest clickState and phase-aware return",
  click
});

const doubleClick = engine.planInteraction("doubleClick");
assert(doubleClick.state === "jumping" && doubleClick.onceReturn === "waiting", {
  reason: "double click should use manifest doubleClickState with phase-aware return",
  doubleClick
});

const dragEnd = engine.planInteraction("dragEnd");
assert(dragEnd.state === "review" && dragEnd.durationMs === 300, {
  reason: "drag end should use manifest post-drag behavior",
  dragEnd
});

const idle = engine.planAutonomous({ autoWander: true, panelOpen: false, dragging: false });
assert(idle?.state === "waiting" && idle.direction === 0 && idle.durationMs === 700, {
  reason: "idle autonomous plan should use life phase defaults",
  idle
});

const gated = engine.planAutonomous({ autoWander: false, panelOpen: false, dragging: false });
assert(gated === null, { reason: "autoWander false should suppress autonomous plan", gated });

const legacyOff = createLifeEngine({
  behavior,
  preferences: { naturalLife: false },
  startedAtMs: 0,
  startPetHour: 8,
  now: () => 0,
  random: () => 0
});
assert(legacyOff.planAutonomous({ autoWander: true }) === null, {
  reason: "naturalLife false should not return autonomous life plans"
});

const fallbackEngine = createLifeEngine({
  behavior: { idleStates: ["review"], wanderDirections: [0] },
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 13,
  now: () => 0,
  random: () => 0
});
assert(fallbackEngine.planAutonomous({ autoWander: true })?.state === "review", {
  reason: "missing behavior.life should still use existing manifest idle states"
});

console.log(JSON.stringify({ ok: true }, null, 2));
```

- [ ] **Step 2: Run the pure smoke test and verify it fails**

Run:

```bash
node src/renderer-life-engine-smoke.mjs
```

Expected: FAIL with `Cannot find module` or missing export errors for `life-engine.js`.

- [ ] **Step 3: Implement the pure life engine**

Create `src/app/renderer/life-engine.js`:

```js
import { STATES } from "./constants.js";

export const PET_TIME_SCALE = 10;

const DEFAULT_NATURAL_BEHAVIOR = {
  nextWanderDelayMs: [3500, 8000],
  idleDurationMs: [1600, 3200],
  walkDurationMs: [2400, 5200],
  edgePauseMs: [700, 1600],
  edgePauseStates: ["waiting", "review"],
  postDragState: "waiting",
  postDragMs: 700,
  clickReturnState: "idle",
  doubleClickReturnState: "idle"
};

const DEFAULT_BEHAVIOR = {
  clickState: "waving",
  doubleClickState: "jumping",
  idleStates: ["review", "waiting", "idle"],
  wanderDirections: [-1, 1, 0],
  natural: DEFAULT_NATURAL_BEHAVIOR
};

const DEFAULT_PHASES = [
  {
    id: "wake",
    from: 6,
    to: 10,
    idleStates: ["waiting", "review", "idle"],
    wanderDirections: [0, 1, -1],
    nextWanderDelayMs: [3200, 7200],
    idleDurationMs: [1500, 3200],
    walkDurationMs: [2200, 4600]
  },
  {
    id: "active",
    from: 10,
    to: 18,
    idleStates: ["review", "waiting", "idle"],
    wanderDirections: [1, -1, 0],
    nextWanderDelayMs: [2600, 6200],
    idleDurationMs: [1200, 2800],
    walkDurationMs: [2600, 5600]
  },
  {
    id: "quiet",
    from: 18,
    to: 22,
    idleStates: ["idle", "waiting", "review"],
    wanderDirections: [0, 1, -1],
    nextWanderDelayMs: [5200, 11000],
    idleDurationMs: [2400, 5200],
    walkDurationMs: [1800, 3600]
  },
  {
    id: "sleepy",
    from: 22,
    to: 6,
    idleStates: ["idle", "waiting"],
    wanderDirections: [0, 0, 1, -1],
    nextWanderDelayMs: [8000, 16000],
    idleDurationMs: [3200, 7200],
    walkDurationMs: [1200, 2600]
  }
];

const DEFAULT_LIFE = {
  phases: DEFAULT_PHASES,
  idleReactionDelayMs: [12000, 32000]
};

export function petHourAt({ nowMs, startedAtMs, startPetHour }) {
  const elapsedPetHours = ((Number(nowMs) - Number(startedAtMs)) / 3600000) * PET_TIME_SCALE;
  return wrapHour(Number(startPetHour) + elapsedPetHours);
}

export function phaseForPetHour(hour, phases = DEFAULT_PHASES) {
  const petHour = wrapHour(hour);
  return normalizedPhases(phases).find((phase) => hourInRange(petHour, phase.from, phase.to)) || DEFAULT_PHASES[0];
}

export function createLifeEngine({
  behavior = {},
  preferences = {},
  now = () => Date.now(),
  random = () => Math.random(),
  startedAtMs = now(),
  startPetHour = localHour(startedAtMs)
} = {}) {
  let currentBehavior = behavior;
  let currentPreferences = preferences;
  let lastQuietState = "";

  function update(next = {}) {
    currentBehavior = next.behavior || currentBehavior;
    currentPreferences = next.preferences || currentPreferences;
  }

  function naturalLifeEnabled() {
    return currentPreferences.naturalLife !== false;
  }

  function phase(nowMs = now()) {
    const active = activeBehavior(currentBehavior);
    const petHour = petHourAt({ nowMs, startedAtMs, startPetHour });
    return phaseForPetHour(petHour, active.life.phases);
  }

  function phaseReturnState() {
    return pickQuietState(activeBehavior(currentBehavior), phase(), random, lastQuietState, (value) => {
      lastQuietState = value;
    });
  }

  function planInteraction(type) {
    const active = activeBehavior(currentBehavior);
    if (type === "click") {
      return {
        kind: "interaction",
        event: type,
        state: active.clickState,
        direction: 0,
        durationMs: active.natural.idleDurationMs[0],
        onceReturn: phaseReturnState()
      };
    }
    if (type === "doubleClick") {
      return {
        kind: "interaction",
        event: type,
        state: active.doubleClickState,
        direction: 0,
        durationMs: active.natural.idleDurationMs[0],
        onceReturn: phaseReturnState()
      };
    }
    if (type === "dragEnd") {
      return {
        kind: "interaction",
        event: type,
        state: active.natural.postDragState,
        direction: 0,
        durationMs: active.natural.postDragMs,
        onceReturn: phaseReturnState()
      };
    }
    return null;
  }

  function planAutonomous({ autoWander = true, panelOpen = false, dragging = false, preferredDirection = 0 } = {}) {
    if (!naturalLifeEnabled() || !autoWander || panelOpen || dragging) {
      return null;
    }
    const active = activeBehavior(currentBehavior);
    const activePhase = phase();
    const directions = activePhase.wanderDirections.length ? activePhase.wanderDirections : active.wanderDirections;
    const direction = directions.includes(preferredDirection) ? preferredDirection : pick(directions, random);
    const moving = direction !== 0;
    const state = direction < 0 ? "running-left" : direction > 0 ? "running-right" : pickQuietState(active, activePhase, random, lastQuietState, (value) => {
      lastQuietState = value;
    });
    return {
      kind: "autonomous",
      event: "idleTimeout",
      phase: activePhase.id,
      state,
      direction,
      durationMs: randomDuration(moving ? activePhase.walkDurationMs : activePhase.idleDurationMs, random),
      nextDelayMs: randomDuration(activePhase.nextWanderDelayMs, random),
      onceReturn: pickQuietState(active, activePhase, random, lastQuietState, (value) => {
        lastQuietState = value;
      })
    };
  }

  function nextAutonomousDelay() {
    const active = activeBehavior(currentBehavior);
    return randomDuration(phase().nextWanderDelayMs || active.life.idleReactionDelayMs, random);
  }

  return {
    naturalLifeEnabled,
    nextAutonomousDelay,
    phase,
    planAutonomous,
    planInteraction,
    update
  };
}

export function activeBehavior(behavior = {}) {
  const natural = behavior.natural || {};
  const life = behavior.life || {};
  const idleStates = validStates(behavior.idleStates);
  const edgePauseStates = validStates(natural.edgePauseStates);
  const wanderDirections = validDirections(behavior.wanderDirections);
  return {
    clickState: STATES[behavior.clickState] ? behavior.clickState : DEFAULT_BEHAVIOR.clickState,
    doubleClickState: STATES[behavior.doubleClickState] ? behavior.doubleClickState : DEFAULT_BEHAVIOR.doubleClickState,
    idleStates: idleStates.length ? idleStates : DEFAULT_BEHAVIOR.idleStates,
    wanderDirections: wanderDirections.length ? wanderDirections : DEFAULT_BEHAVIOR.wanderDirections,
    natural: {
      nextWanderDelayMs: readDurationRange(natural.nextWanderDelayMs, DEFAULT_NATURAL_BEHAVIOR.nextWanderDelayMs),
      idleDurationMs: readDurationRange(natural.idleDurationMs, DEFAULT_NATURAL_BEHAVIOR.idleDurationMs),
      walkDurationMs: readDurationRange(natural.walkDurationMs, DEFAULT_NATURAL_BEHAVIOR.walkDurationMs),
      edgePauseMs: readDurationRange(natural.edgePauseMs, DEFAULT_NATURAL_BEHAVIOR.edgePauseMs),
      edgePauseStates: edgePauseStates.length ? edgePauseStates : DEFAULT_NATURAL_BEHAVIOR.edgePauseStates,
      postDragState: STATES[natural.postDragState] ? natural.postDragState : DEFAULT_NATURAL_BEHAVIOR.postDragState,
      postDragMs: readDurationRange(natural.postDragMs, [DEFAULT_NATURAL_BEHAVIOR.postDragMs, DEFAULT_NATURAL_BEHAVIOR.postDragMs])[0],
      clickReturnState: STATES[natural.clickReturnState] ? natural.clickReturnState : DEFAULT_NATURAL_BEHAVIOR.clickReturnState,
      doubleClickReturnState: STATES[natural.doubleClickReturnState]
        ? natural.doubleClickReturnState
        : DEFAULT_NATURAL_BEHAVIOR.doubleClickReturnState
    },
    life: {
      phases: normalizedPhases(life.phases).map((phase) => mergePhase(phase, behavior)),
      idleReactionDelayMs: readDurationRange(life.idleReactionDelayMs, DEFAULT_LIFE.idleReactionDelayMs)
    }
  };
}

function mergePhase(phase, behavior = {}) {
  const natural = behavior.natural || {};
  const idleStates = validStates(phase.idleStates);
  const manifestIdleStates = validStates(behavior.idleStates);
  return {
    ...phase,
    idleStates: idleStates.length ? idleStates : manifestIdleStates.length ? manifestIdleStates : DEFAULT_BEHAVIOR.idleStates,
    wanderDirections: validDirections(phase.wanderDirections).length
      ? validDirections(phase.wanderDirections)
      : validDirections(behavior.wanderDirections).length
        ? validDirections(behavior.wanderDirections)
        : DEFAULT_BEHAVIOR.wanderDirections,
    nextWanderDelayMs: readDurationRange(phase.nextWanderDelayMs, readDurationRange(natural.nextWanderDelayMs, DEFAULT_NATURAL_BEHAVIOR.nextWanderDelayMs)),
    idleDurationMs: readDurationRange(phase.idleDurationMs, readDurationRange(natural.idleDurationMs, DEFAULT_NATURAL_BEHAVIOR.idleDurationMs)),
    walkDurationMs: readDurationRange(phase.walkDurationMs, readDurationRange(natural.walkDurationMs, DEFAULT_NATURAL_BEHAVIOR.walkDurationMs))
  };
}

function normalizedPhases(phases) {
  if (!Array.isArray(phases)) {
    return DEFAULT_PHASES;
  }
  const normalized = phases
    .map((phase) => ({
      id: typeof phase.id === "string" && phase.id.trim() ? phase.id.trim() : "custom",
      from: clampHour(phase.from),
      to: clampHour(phase.to),
      idleStates: validStates(phase.idleStates),
      wanderDirections: validDirections(phase.wanderDirections),
      nextWanderDelayMs: readDurationRange(phase.nextWanderDelayMs, DEFAULT_NATURAL_BEHAVIOR.nextWanderDelayMs),
      idleDurationMs: readDurationRange(phase.idleDurationMs, DEFAULT_NATURAL_BEHAVIOR.idleDurationMs),
      walkDurationMs: readDurationRange(phase.walkDurationMs, DEFAULT_NATURAL_BEHAVIOR.walkDurationMs)
    }))
    .filter((phase) => phase.from !== phase.to);
  return normalized.length ? normalized : DEFAULT_PHASES;
}

function readDurationRange(value, fallback) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second) && first >= 0 && second >= 0) {
      return [Math.min(first, second), Math.max(first, second)];
    }
  }
  const single = Number(value);
  if (Number.isFinite(single) && single >= 0) {
    return [single, single];
  }
  return fallback;
}

function validStates(states) {
  return Array.isArray(states) ? states.filter((name) => STATES[name]) : [];
}

function validDirections(directions) {
  return Array.isArray(directions) ? directions.filter((direction) => [-1, 0, 1].includes(direction)) : [];
}

function randomDuration(range, random) {
  const [min, max] = range;
  return min + random() * (max - min);
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function pickQuietState(active, phase, random, lastQuietState, setLastQuietState) {
  const states = phase.idleStates?.length ? phase.idleStates : active.idleStates;
  const candidates = states.length > 1 ? states.filter((stateName) => stateName !== lastQuietState) : states;
  const nextState = pick(candidates.length ? candidates : states, random) || "idle";
  setLastQuietState(nextState);
  return nextState;
}

function localHour(nowMs) {
  const date = new Date(nowMs);
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function wrapHour(value) {
  const hour = Number(value);
  if (!Number.isFinite(hour)) {
    return 0;
  }
  return ((hour % 24) + 24) % 24;
}

function clampHour(value) {
  const hour = Number(value);
  if (!Number.isFinite(hour)) {
    return 0;
  }
  return Math.max(0, Math.min(24, hour));
}

function hourInRange(hour, from, to) {
  if (from < to) {
    return hour >= from && hour < to;
  }
  return hour >= from || hour < to;
}
```

- [ ] **Step 4: Run the pure smoke test and verify it passes**

Run:

```bash
node src/renderer-life-engine-smoke.mjs
```

Expected: PASS with `{"ok": true}`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/app/renderer/life-engine.js src/renderer-life-engine-smoke.mjs
git commit -m "feat: add pet life engine planner"
```

## Task 2: Preferences And Renderer Toggle

**Files:**
- Modify: `src-tauri/src/preferences.rs`
- Modify: `src/app/renderer.html`
- Modify: `src/app/renderer/dom.js`
- Modify: `src/app/renderer/index.js`
- Modify: `src/renderer-smoke-harness.js`
- Modify: `src/renderer-settings-smoke.js`
- Modify: `src/renderer-english-smoke.js`

- [ ] **Step 1: Write failing preference assertions**

In `src-tauri/src/preferences.rs`, update the `saves_and_loads_user_preferences` expected struct to include `natural_life: false`, and update `missing_newer_preference_fields_use_defaults` to assert `loaded.natural_life`.

Use these exact edits inside tests:

```rust
let preferences = UserPreferences {
    selected_pet_id: "mi-fen".to_string(),
    scale: 1.2,
    pet_direction: "left".to_string(),
    auto_wander: false,
    always_on_top: false,
    natural_life: false,
};
```

And after the existing assertions in `missing_newer_preference_fields_use_defaults`:

```rust
assert!(loaded.natural_life);
```

- [ ] **Step 2: Run Rust preference tests and verify they fail**

Run:

```bash
cd src-tauri && cargo test preferences
```

Expected: FAIL because `UserPreferences` has no `natural_life` field.

- [ ] **Step 3: Add the persisted Rust preference**

Modify `src-tauri/src/preferences.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct UserPreferences {
    pub(crate) selected_pet_id: String,
    pub(crate) scale: f64,
    pub(crate) pet_direction: String,
    pub(crate) auto_wander: bool,
    pub(crate) always_on_top: bool,
    pub(crate) natural_life: bool,
}
```

And in `impl Default for UserPreferences`:

```rust
Self {
    selected_pet_id: String::new(),
    scale: 0.6,
    pet_direction: "right".to_string(),
    auto_wander: true,
    always_on_top: true,
    natural_life: true,
}
```

- [ ] **Step 4: Add failing renderer toggle checks**

Update `src/renderer-settings-smoke.js`:

```js
getPreferences: async () => ({
  selectedPetId: "mi-jiu",
  scale: 1.1,
  autoWander: false,
  alwaysOnTop: false,
  naturalLife: false
}),
```

Extend the stored-preferences assertion:

```js
elements.get("#naturalLifeToggle").checked
```

Add the field to the error payload:

```js
naturalLife: elements.get("#naturalLifeToggle").checked
```

Add a change event after `wanderToggle`:

```js
elements.get("#naturalLifeToggle").checked = true;
elements.get("#naturalLifeToggle").dispatch("change");
```

Extend the save assertion:

```js
merged.naturalLife !== true
```

Update `src/renderer-english-smoke.js` expected text:

```js
"Natural life rhythm",
```

- [ ] **Step 5: Run renderer settings smoke and verify it fails**

Run:

```bash
node src/renderer-settings-smoke.js
```

Expected: FAIL because `#naturalLifeToggle` is not in the fake DOM or real DOM.

- [ ] **Step 6: Add the UI and DOM wiring**

In `src/app/renderer.html`, add this checkbox after the `Automatic wandering` checkbox and before `Always on top`:

```html
<label class="check-row">
  <input id="naturalLifeToggle" type="checkbox" checked />
  <span>Natural life rhythm</span>
</label>
```

In `src/app/renderer/dom.js`, add:

```js
naturalLifeToggle: document.querySelector("#naturalLifeToggle"),
```

immediately after `wanderToggle`.

In `src/renderer-smoke-harness.js`, update `createFakeElement` default checked expression:

```js
checked: selector === "#wanderToggle" || selector === "#naturalLifeToggle" || selector === "#topToggle",
```

Add `"#naturalLifeToggle"` to the `selectors` array immediately after `"#wanderToggle"`.

- [ ] **Step 7: Add renderer preference plumbing**

In `src/app/renderer/index.js`, add default state:

```js
naturalLife: true,
```

after `autoWander: true`.

In `currentPreferences`, add:

```js
naturalLife: Boolean(dom.naturalLifeToggle.checked),
```

after `autoWander`.

In `applyPreferences`, add:

```js
dom.naturalLifeToggle.checked = state.preferences.naturalLife !== false;
```

after the `wanderToggle` assignment.

After the `wanderToggle` change listener, add:

```js
dom.naturalLifeToggle.addEventListener("change", () => {
  savePreferences({ naturalLife: Boolean(dom.naturalLifeToggle.checked) });
});
```

- [ ] **Step 8: Run preference and localization checks**

Run:

```bash
cd src-tauri && cargo test preferences
node ../src/renderer-settings-smoke.js
node ../src/renderer-english-smoke.js
```

Expected: all PASS.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add src-tauri/src/preferences.rs src/app/renderer.html src/app/renderer/dom.js src/app/renderer/index.js src/renderer-smoke-harness.js src/renderer-settings-smoke.js src/renderer-english-smoke.js
git commit -m "feat: add natural life preference"
```

## Task 3: Integrate Life Engine With Interactions

**Files:**
- Modify: `src/app/renderer/interactions.js`
- Modify: `src/renderer-natural-behavior-smoke.js`
- Create: `src/renderer-life-integration-smoke.js`

- [ ] **Step 1: Add failing integration smoke**

Create `src/renderer-life-integration-smoke.js`:

```js
const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const moveCalls = [];
  const pet = {
    id: "mi-fen",
    displayName: "Mi Fen",
    version: "1.0.3",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    behavior: {
      clickState: "waiting",
      doubleClickState: "jumping",
      idleStates: ["review"],
      wanderDirections: [1],
      natural: {
        nextWanderDelayMs: [400, 400],
        idleDurationMs: [600, 600],
        walkDurationMs: [800, 800],
        postDragState: "review",
        postDragMs: 200
      },
      life: {
        phases: [
          {
            id: "active",
            from: 0,
            to: 24,
            idleStates: ["waiting"],
            wanderDirections: [1],
            nextWanderDelayMs: [250, 250],
            idleDurationMs: [500, 500],
            walkDurationMs: [750, 750]
          }
        ]
      }
    }
  };

  const { elements, timeouts, animationFrames } = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.14", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ autoWander: true, naturalLife: true }),
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
    }
  });

  if (timeouts.at(-1)?.delay !== 250) {
    console.error(JSON.stringify({ ok: false, reason: "life phase delay not scheduled", delay: timeouts.at(-1)?.delay }));
    process.exit(1);
  }

  timeouts.at(-1)?.();
  if (elements.get("#stateSelect").value !== "running-right") {
    console.error(JSON.stringify({ ok: false, reason: "life plan did not start phase movement", state: elements.get("#stateSelect").value }));
    process.exit(1);
  }

  animationFrames.at(-1)?.(100);
  if (!moveCalls.length) {
    console.error(JSON.stringify({ ok: false, reason: "life movement plan did not move window" }));
    process.exit(1);
  }

  elements.get("#pet").click();
  if (elements.get("#stateSelect").value !== "waiting") {
    console.error(JSON.stringify({ ok: false, reason: "click interaction did not use life integration", state: elements.get("#stateSelect").value }));
    process.exit(1);
  }

  const legacy = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.14", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ autoWander: true, naturalLife: false }),
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
      moveBy: async () => ({ hitEdge: "" }),
      setIgnoreMouseEvents: async () => {},
      resizeWindow: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  if (legacy.timeouts.at(-1)?.delay !== 400) {
    console.error(JSON.stringify({ ok: false, reason: "legacy wander delay should be preserved when naturalLife is false", delay: legacy.timeouts.at(-1)?.delay }));
    process.exit(1);
  }

  const disabled = await loadRenderer({
    random: () => 0,
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.14", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ autoWander: false, naturalLife: true }),
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
      moveBy: async () => ({ hitEdge: "" }),
      setIgnoreMouseEvents: async () => {},
      resizeWindow: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  disabled.timeouts.at(-1)?.();
  if (disabled.elements.get("#stateSelect").value === "running-right") {
    console.error(JSON.stringify({ ok: false, reason: "autoWander false should suppress autonomous life movement" }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, moveCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the integration smoke and verify it fails**

Run:

```bash
node src/renderer-life-integration-smoke.js
```

Expected: FAIL because `interactions.js` does not use life phase delays yet.

- [ ] **Step 3: Import and instantiate the life engine**

In `src/app/renderer/interactions.js`, replace the current first line with:

```js
import { activeBehavior, createLifeEngine } from "./life-engine.js";
```

Remove the local `defaultNaturalBehavior`, `defaultBehavior`, `activeBehavior`, `readDurationRange`, `randomDuration`, `pick`, and `pickQuietState` functions from `interactions.js`.

Keep the existing `lastQuietState` declaration. Add this variable after the existing `preferredNextDirection` declaration:

```js
let lifeEngine = createLifeEngine({
  behavior: state.activePet?.behavior || {},
  preferences: state.preferences,
  random: () => Math.random()
});
```

Add helper functions before `isWindowsRuntime`:

```js
function refreshLifeEngine() {
  lifeEngine.update({
    behavior: state.activePet?.behavior || {},
    preferences: state.preferences
  });
}

function naturalLifeEnabled() {
  refreshLifeEngine();
  return lifeEngine.naturalLifeEnabled();
}

function randomDuration(range) {
  const [min, max] = range;
  return min + Math.random() * (max - min);
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickQuietState(behavior) {
  const candidates =
    behavior.idleStates.length > 1
      ? behavior.idleStates.filter((stateName) => stateName !== lastQuietState)
      : behavior.idleStates;
  const nextState = pick(candidates.length ? candidates : behavior.idleStates);
  lastQuietState = nextState;
  return nextState;
}
```

- [ ] **Step 4: Route scheduling through life plans**

In `scheduleWander`, call `refreshLifeEngine()` before reading behavior and replace:

```js
const behavior = activeBehavior();
```

with:

```js
const behavior = activeBehavior(state.activePet?.behavior || {});
```

Inside the timeout callback, replace the block that chooses `directions`, `wanderDirection`, `wanderUntil`, and animation state with:

```js
      const lifePlan = naturalLifeEnabled()
        ? lifeEngine.planAutonomous({
            autoWander: Boolean(dom.wanderToggle.checked),
            panelOpen: dom.panelEl.classList.contains("hidden") === false,
            dragging,
            preferredDirection: preferredNextDirection
          })
        : null;
      if (lifePlan) {
        wanderDirection = lifePlan.direction;
        preferredNextDirection = 0;
        edgePaused = false;
        wanderUntil = performance.now() + lifePlan.durationMs;
        animation.setState(lifePlan.state, { onceReturn: lifePlan.onceReturn });
        return;
      }
      const directions = behavior.wanderDirections;
      wanderDirection = directions.includes(preferredNextDirection)
        ? preferredNextDirection
        : pick(directions);
      preferredNextDirection = 0;
      edgePaused = false;
      wanderUntil =
        performance.now() +
        randomDuration(wanderDirection === 0 ? behavior.natural.idleDurationMs : behavior.natural.walkDurationMs);
      if (wanderDirection < 0) {
        animation.setState("running-left");
      } else if (wanderDirection > 0) {
        animation.setState("running-right");
      } else {
        animation.setState(pickQuietState(behavior));
      }
```

Keep the existing guard above it unchanged, so panel-open, dragging, no-pet, and auto-wander-off states reschedule without autonomous motion.

- [ ] **Step 5: Update remaining active behavior call sites**

In `wanderLoop`, replace both edge-collision blocks:

```js
const behavior = activeBehavior();
```

with:

```js
const behavior = activeBehavior(state.activePet?.behavior || {});
```

In the `wanderUntil` completion block, replace:

```js
animation.setState(edgePaused ? "idle" : pickQuietState(activeBehavior()));
```

with:

```js
animation.setState(edgePaused ? "idle" : pickQuietState(activeBehavior(state.activePet?.behavior || {})));
```

- [ ] **Step 6: Use life plans for direct interactions**

In `finishDrag`, replace the moved-during-drag block with:

```js
      const behavior = activeBehavior(state.activePet?.behavior || {});
      const plan = naturalLifeEnabled() ? lifeEngine.planInteraction("dragEnd") : null;
      suppressNextClick = true;
      animation.setState(plan?.state || behavior.natural.postDragState, {
        onceReturn: plan?.onceReturn || behavior.natural.clickReturnState
      });
      scheduleWander(plan?.durationMs || behavior.natural.postDragMs);
```

In the `click` handler, replace the behavior block with:

```js
        const behavior = activeBehavior(state.activePet?.behavior || {});
        const plan = naturalLifeEnabled() ? lifeEngine.planInteraction("click") : null;
        animation.setState(plan?.state || behavior.clickState, {
          onceReturn: plan?.onceReturn || behavior.natural.clickReturnState
        });
```

In the `dblclick` handler, replace the behavior block with:

```js
      const behavior = activeBehavior(state.activePet?.behavior || {});
      const plan = naturalLifeEnabled() ? lifeEngine.planInteraction("doubleClick") : null;
      animation.setState(plan?.state || behavior.doubleClickState, {
        onceReturn: plan?.onceReturn || behavior.natural.doubleClickReturnState
      });
```

- [ ] **Step 7: Keep active pet and preference changes synced**

Expose a new method in the return object:

```js
refreshLifeEngine,
```

In `src/app/renderer/index.js`, after `applyPreferences((await petDesktop.getPreferences?.()) || {});`, add:

```js
interactions.refreshLifeEngine();
```

In `pet-manager.js`, no direct change is needed because `pickPet` already updates `state.activePet` before scheduling; `scheduleWander` refreshes the engine before planning.

In the `naturalLifeToggle` change listener from Task 2, add a refresh before saving:

```js
state.preferences = currentPreferences({ naturalLife: Boolean(dom.naturalLifeToggle.checked) });
interactions.refreshLifeEngine();
savePreferences({ naturalLife: Boolean(dom.naturalLifeToggle.checked) });
```

- [ ] **Step 8: Run focused integration checks**

Run:

```bash
node src/renderer-life-engine-smoke.mjs
node src/renderer-life-integration-smoke.js
node src/renderer-natural-behavior-smoke.js
node src/renderer-behavior-config-smoke.js
node src/renderer-edge-behavior-smoke.js
```

Expected: all PASS.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
git add src/app/renderer/interactions.js src/app/renderer/index.js src/renderer-life-integration-smoke.js src/renderer-natural-behavior-smoke.js
git commit -m "feat: integrate life engine with pet interactions"
```

## Task 4: Smoke Suite And Final Regression

**Files:**
- Modify: `package.json`
- Verify: `src/renderer-smoke-harness.js`
- Verify: `src/renderer-natural-behavior-smoke.js`
- Verify: `src/renderer-life-engine-smoke.mjs`
- Verify: `src/renderer-life-integration-smoke.js`

- [ ] **Step 1: Add new smoke tests to npm script**

In `package.json`, insert the new tests after `node src/renderer-natural-behavior-smoke.js`:

```json
"node src/renderer-natural-behavior-smoke.js && node src/renderer-life-engine-smoke.mjs && node src/renderer-life-integration-smoke.js && node src/renderer-store-filter-smoke.js"
```

Keep the rest of the existing `smoke` command order unchanged.

- [ ] **Step 2: Run full renderer and petpack smoke suite**

Run:

```bash
npm run smoke
```

Expected: PASS. If a smoke test fails because it now needs the fake `naturalLifeToggle`, update `src/renderer-smoke-harness.js` selector/default wiring rather than weakening the test.

- [ ] **Step 3: Run Rust tests**

Run:

```bash
cd src-tauri && cargo test
```

Expected: PASS.

- [ ] **Step 4: Check final git diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only the intended life-engine, preferences, renderer, smoke, and package files are changed.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add package.json package-lock.json src/renderer-smoke-harness.js src/renderer-*.js src/app/renderer src-tauri/src/preferences.rs
git commit -m "test: cover natural pet life behavior"
```

Skip this commit if Task 4 only verified existing committed changes and there is no diff.
