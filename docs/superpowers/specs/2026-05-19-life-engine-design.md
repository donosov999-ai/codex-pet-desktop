# Desktop Pet Life Engine Design

## Goal

Make the desktop pet feel more alive during the current app run without adding long-term relationship state. The first delivery should combine a daily rhythm with clear but restrained interaction feedback. A later follow-up can add environment reactions on top of the same event model.

## Scope

In scope:

- A lightweight renderer-side life engine.
- A fixed accelerated pet clock where 1 real hour equals 10 pet hours.
- A daily rhythm that changes behavior weights by pet time.
- Click, double-click, drag-end, and long-idle interaction events.
- Medium-intensity autonomous idle reactions.
- A user-facing switch for the natural life rhythm, default enabled.
- Backward compatibility for existing pet manifests.

Out of scope:

- Long-term mood, intimacy, memory, or cross-restart state.
- Persistent history of interactions.
- Environment sensing beyond existing edge handling.
- New sprite atlas rows or new required animation states.

## Experience

When the natural life rhythm is enabled, the pet has an internal day that runs at 10x real time. The engine uses that pet time as a broad mood for the current session:

- Wake and active periods favor short walks, small runs, waiting, and observing.
- Quiet periods favor idle, waiting, and occasional short movement.
- Sleepy periods reduce movement and favor idle or waiting.

Interactions briefly interrupt that rhythm:

- Click uses the pet manifest's `clickState` when available.
- Double-click uses `doubleClickState` when available.
- Drag-end uses the manifest's post-drag behavior when available.
- After the interruption ends, the pet returns to a state that fits the current pet-time phase instead of always snapping back to `idle`.

If the user leaves the pet alone for a while, it may perform a medium-intensity autonomous reaction. Examples include walking a short distance, changing posture, observing, waiting, or resting near an edge. It should not repeatedly demand attention or create constant motion.

Existing controls remain meaningful:

- `自动散步` stays the movement and autonomous-behavior gate. When it is off, click, double-click, and drag feedback still work, but the pet does not self-initiate movement.
- The new natural-life switch controls phase-aware behavior selection. When disabled, the app uses the current simpler random wander behavior.

## Architecture

Add a renderer module named `src/app/renderer/life-engine.js`.

The life engine owns:

- Pet-time calculation.
- Phase selection.
- Manifest defaulting and validation for optional life behavior settings.
- Event intake for `click`, `doubleClick`, `dragEnd`, and `idleTimeout`.
- Choosing the next behavior plan.

A behavior plan is a small object returned to `interactions.js`. It should describe:

- The animation state to play.
- Whether the action is an interruption or autonomous behavior.
- Optional movement direction.
- Duration or next scheduling window.
- The preferred return state after one-shot animations.

`interactions.js` continues to own browser and desktop integration:

- Pointer events.
- Dragging and window movement.
- Edge collision handling.
- Calling `animation.setState()`.
- Calling `petDesktop.moveBy()`.
- Scheduling timers and animation-frame loops.

The integration should make `interactions.js` ask the life engine what to do next, while keeping all Tauri/window side effects in `interactions.js`.

## Manifest Compatibility

Existing `behavior` fields continue to work:

- `clickState`
- `doubleClickState`
- `idleStates`
- `wanderDirections`
- `natural.nextWanderDelayMs`
- `natural.idleDurationMs`
- `natural.walkDurationMs`
- `natural.edgePauseMs`
- `natural.edgePauseStates`
- `natural.postDragState`
- `natural.postDragMs`
- `natural.clickReturnState`
- `natural.doubleClickReturnState`

Add an optional `behavior.life` object for per-pet overrides. The first version can support phase weights and idle reaction timing while providing complete defaults when the field is absent. Old petpacks must behave correctly without modification.

## Preferences

Add `naturalLife` to user preferences with default `true`.

The renderer panel should expose this as a compact checkbox or toggle near `自动散步`, using Chinese UI copy consistent with the current panel. The preference must survive restart and fall back to enabled for older preference files.

## Data Flow

1. App loads pets and preferences.
2. `interactions.js` creates the life engine using the active pet behavior and preferences.
3. When active pet or preferences change, `interactions.js` updates or recreates the life engine view of behavior settings.
4. Pointer events call the life engine with interaction events.
5. Idle timers call the life engine with an idle event when `autoWander` and `naturalLife` are both enabled.
6. The life engine returns a behavior plan.
7. `interactions.js` executes the plan through animation state changes, window movement, timers, and edge handling.

## Error Handling

Invalid manifest values should be ignored and replaced with defaults. A bad `behavior.life` object must not prevent the pet from loading. The existing manifest behavior remains the baseline fallback.

If the natural-life preference is missing or malformed, it should default to enabled. If the engine cannot choose a valid state for any reason, it should fall back to `idle`.

## Testing

Add focused smoke coverage around the renderer life engine:

- Pet time scales at 10x and maps to expected phases.
- Click, double-click, and drag-end events return valid interruption plans.
- Interruption return states are phase-aware.
- Long-idle events can produce medium-intensity autonomous plans.
- `autoWander: false` suppresses autonomous plans but not direct interaction plans.
- `naturalLife: false` preserves current simple wander behavior.
- Missing `behavior.life` still works with existing pet manifests.

Add Rust preference tests for the new default field if the preference struct changes.

## Follow-Up Path

The later environment-reaction phase should use the same life-engine event intake. Candidate future events include mouse proximity, screen edge dwell time, focused-window state, and low-battery or time-of-day signals. Those are intentionally excluded from this spec so the A+B loop can land cleanly first.
