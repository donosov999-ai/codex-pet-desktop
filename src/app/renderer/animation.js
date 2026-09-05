import { ATLAS_HEIGHT, ATLAS_WIDTH, CELL_HEIGHT, CELL_WIDTH, STATES, STATE_LABELS } from "./constants.js";

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(finiteNumber(value, fallback));
  return number > 0 ? number : fallback;
}

function normalizeCareTimeline(rawTimeline, frameCount) {
  if (!Array.isArray(rawTimeline) || !rawTimeline.length) {
    return null;
  }

  const timeline = [];
  for (const segment of rawTimeline) {
    if (!segment || typeof segment !== "object" || !Array.isArray(segment.frames) || !segment.frames.length) {
      return null;
    }
    const frames = segment.frames.map((value) => Math.floor(finiteNumber(value, -1)));
    const frameDurationMs = Math.round(finiteNumber(segment.frameDurationMs, 0));
    const repeat = positiveInteger(segment.repeat, 1);
    if (
      frames.some((value) => value < 0 || value >= frameCount) ||
      frameDurationMs < 50 ||
      repeat > 100 ||
      timeline.length + frames.length * repeat > 512
    ) {
      return null;
    }
    for (let iteration = 0; iteration < repeat; iteration += 1) {
      for (const frame of frames) {
        timeline.push({ frame, durationMs: frameDurationMs });
      }
    }
  }
  return timeline.length ? timeline : null;
}

export function normalizeCareConfig(care = {}) {
  const source = care && typeof care === "object" ? care : {};
  const atlasSource = source.atlas && typeof source.atlas === "object" ? source.atlas : {};
  const columns = positiveInteger(atlasSource.columns, 8);
  const rows = positiveInteger(atlasSource.rows, 1);
  const cellWidth = positiveInteger(atlasSource.cellWidth, CELL_WIDTH);
  const cellHeight = positiveInteger(atlasSource.cellHeight, CELL_HEIGHT);
  const atlas = {
    columns,
    rows,
    cellWidth,
    cellHeight,
    width: positiveInteger(atlasSource.width, columns * cellWidth),
    height: positiveInteger(atlasSource.height, rows * cellHeight)
  };
  // Layers around the pet: an effect above (hearts, confetti, steam) and a scene below (litter
  // box, bowl, mat). They live as rows in this same atlas, so the config that already describes
  // the care states is the right place to describe them too.
  const overlays = {};
  const rawOverlays = source.overlays && typeof source.overlays === "object" ? source.overlays : {};
  for (const [id, raw] of Object.entries(rawOverlays)) {
    if (!raw || typeof raw !== "object") continue;
    overlays[id] = {
      row: positiveInteger(raw.row, 0),
      frames: positiveInteger(raw.frames, 1),
      fps: Number(raw.fps) > 0 ? Number(raw.fps) : 6,
      layer: raw.layer === "below" ? "below" : "above"
    };
  }
  const stateOverlays = {};
  const rawStateOverlays =
    source.stateOverlays && typeof source.stateOverlays === "object" ? source.stateOverlays : {};
  for (const [state, id] of Object.entries(rawStateOverlays)) {
    if (overlays[id]) stateOverlays[state] = id;
  }

  const states = {};
  const rawStates = source.states && typeof source.states === "object" ? source.states : {};

  for (const [id, raw] of Object.entries(rawStates)) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id) || STATES[id] || !raw || typeof raw !== "object") {
      continue;
    }
    const row = Math.floor(finiteNumber(raw.row, -1));
    const frames = positiveInteger(raw.frames, 0);
    const fps = finiteNumber(raw.fps, 0);
    if (row < 0 || row >= rows || frames < 1 || frames > columns || fps <= 0) {
      continue;
    }
    const timeline = normalizeCareTimeline(raw.timeline, frames);
    const cycleDurationMs = (frames / fps) * 1000;
    const requestedDurationMs = Math.max(1000, finiteNumber(raw.durationMs, 6000));
    const requestedLoops = positiveInteger(raw.loops, 0);
    const loops = timeline ? 1 : Math.max(1, requestedLoops, Math.ceil(requestedDurationMs / cycleDurationMs));
    const durationMs = timeline
      ? timeline.reduce((sum, step) => sum + step.durationMs, 0)
      : Math.round(loops * cycleDurationMs);
    states[id] = {
      atlas: "care",
      row,
      frames,
      fps,
      loops,
      cycleDurationMs: timeline ? durationMs : Math.round(cycleDurationMs),
      once: raw.once === true,
      mirror: raw.mirror !== false,
      durationMs,
      ...(timeline ? { timeline } : {}),
      label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : id
    };
  }

  const autonomousStates = Array.isArray(source.autonomousStates)
    ? source.autonomousStates.filter((id) => states[id])
    : [];
  const autonomousChance = Math.min(Math.max(finiteNumber(source.autonomousChance, 0), 0), 1);

  return { atlas, states, overlays, stateOverlays, autonomousStates, autonomousChance };
}

export function createAnimation(dom) {
  let states = { ...STATES };
  let stateLabels = { ...STATE_LABELS };
  let careConfig = normalizeCareConfig();
  let geometry = { cellWidth: CELL_WIDTH, cellHeight: CELL_HEIGHT, columns: 8 };
  let overlayElapsedMs = 0;
  let sources = {
    standard: { url: "", width: ATLAS_WIDTH, height: ATLAS_HEIGHT },
    care: { url: "", width: 0, height: 0 }
  };
  let stateName = "idle";
  let manualDirection = "right";
  let frame = 0;
  let timelineIndex = 0;
  let timelineStarted = false;
  let lastFrameAt = 0;
  let onceReturnState = "idle";

  function normalizedDirection(direction) {
    return direction === "left" ? "left" : "right";
  }

  function applyDirection() {
    const state = states[stateName] || states.idle;
    const scale = stateName === "running-left" || stateName === "running-right" || state.mirror === false
      ? 1
      : normalizedDirection(manualDirection) === "left"
        ? -1
        : 1;
    dom.petEl.style.setProperty("--direction-scale", String(scale));
  }

  function setFrame() {
    const state = states[stateName] || states.idle;
    const source = sources[state.atlas || "standard"] || sources.standard;
    const cellWidth = state.atlas === "care" ? careConfig.atlas.cellWidth : geometry.cellWidth;
    const cellHeight = state.atlas === "care" ? careConfig.atlas.cellHeight : geometry.cellHeight;
    const x = -(frame % state.frames) * cellWidth;
    const y = -state.row * cellHeight;
    dom.petEl.style.backgroundImage = source.url ? `url("${source.url}")` : "";
    dom.petEl.style.backgroundSize = `${source.width}px ${source.height}px`;
    dom.petEl.style.backgroundPosition = `${x}px ${y}px`;
    setOverlayFrame();
  }

  /// The layer that belongs to the current state: hearts for love, confetti for celebrate. Frames
  /// come from the same care atlas — a separate file would have meant new Rust-side paths for the
  /// very same images. The layer runs at its own pace, independent of the pet's frames.
  function setOverlayFrame() {
    const above = dom.petAboveEl;
    const below = dom.petBelowEl;
    if (!above && !below) {
      return;
    }
    const id = careConfig.stateOverlays?.[stateName];
    const overlay = id ? careConfig.overlays[id] : null;
    for (const element of [above, below]) {
      if (element) element.classList.remove("visible");
    }
    if (!overlay) {
      return;
    }
    const element = overlay.layer === "below" ? below : above;
    if (!element) {
      return;
    }
    const care = sources.care;
    const { cellWidth, cellHeight } = careConfig.atlas;
    const step = Math.floor(overlayElapsedMs / (1000 / overlay.fps)) % overlay.frames;
    element.style.backgroundImage = care.url ? `url("${care.url}")` : "";
    element.style.backgroundSize = `${care.width}px ${care.height}px`;
    element.style.backgroundPosition = `${-step * cellWidth}px ${-overlay.row * cellHeight}px`;
    element.classList.add("visible");
  }

  function setState(nextState, { onceReturn = "idle" } = {}) {
    if (!states[nextState]) {
      return false;
    }
    stateName = nextState;
    timelineIndex = 0;
    timelineStarted = false;
    frame = states[nextState].timeline?.[0]?.frame ?? 0;
    lastFrameAt = 0;
    onceReturnState = states[onceReturn] ? onceReturn : "idle";
    dom.stateSelect.value = nextState;
    applyDirection();
    setFrame();
    return true;
  }

  function setDirection(direction) {
    manualDirection = normalizedDirection(direction);
    applyDirection();
  }

  function renderStateOptions() {
    dom.stateSelect.replaceChildren(
      ...Object.keys(states).map((state) => {
        const option = document.createElement("option");
        option.value = state;
        option.textContent = stateLabels[state] || state;
        return option;
      })
    );
  }

/// Per-pack timing for the standard states.
///
/// The built-in speeds were tuned for hand-drawn six-frame loops. Our 3D packs fill the same rows
/// with frames sampled out of a longer cycle, so at the built-in ten frames a second the gaps
/// between phases read as jitter rather than motion. A pack may therefore state its own pace, and
/// packs that say nothing keep the built-in one.
function stateTimingOverrides(raw, columns, missing = new Set()) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const overrides = {};
  for (const [id, timing] of Object.entries(raw)) {
    const base = STATES[id];
    if (!base) {
      continue;
    }
    const next = { ...base };
    const fps = Number(timing?.fps);
    // Below two frames a second motion turns into a slideshow, above twelve the eye cannot
    // follow it - a pack asking for anything outside that is a mistake, not a style.
    if (fps >= 2 && fps <= 12) {
      next.fps = fps;
    }
    // 🔴 A PACK MAY NOW SAY HOW MANY FRAMES ITS ROW HOLDS, and that is the point of this change.
    // The counts used to be fixed in constants.js at what an 8-column atlas could carry: idle 6,
    // walk 8, wave 4. The drawn animations have 16, 18 and 16, so building a pack threw away
    // 56-75% of the motion and what reached the screen was every third frame. That is the jerk
    // the owner sees; it is not a cutting defect, it is thinning.
    const frames = Number(timing?.frames);
    if (Number.isInteger(frames) && frames >= 1 && frames <= columns) {
      next.frames = frames;
    }
    // 🔴 ZERO IS NOT "USE THE DEFAULT", IT IS "THIS PACK HAS NO ART FOR THIS STATE".
    // Seventeen packs have no walk drawn anywhere. Filling the walk row with copies of the idle
    // pose made them glide across the desk without moving their legs, which reads as a broken pet
    // rather than a missing animation - so the builder now leaves the row empty and says frames: 0.
    // Honouring that here is what keeps the app out of a row it would draw as a blank rectangle.
    // Idle is never removable: it is the fallback every other state returns to.
    if (frames === 0 && id !== "idle") {
      missing.add(id);
      continue;
    }
    if (next.fps !== base.fps || next.frames !== base.frames) {
      overrides[id] = next;
    }
  }
  return overrides;
}

  function configurePet(pet, { standardSource = "", careSource = "" } = {}) {
    careConfig = normalizeCareConfig(careSource ? pet?.care : {});
    // 🔴 THE CELL IS A PROPERTY OF THE PACK, NOT A CONSTANT OF THE APP.
    // A square-ish 192x208 cell cannot hold a four-legged animal in profile: measured against the
    // reference deck, fox needs 242px of width for its drawn height and hedgehog 241, so both lose
    // a fifth of the picture at the edges. The web side solved this a month ago by letting the
    // cell be as wide as the pose needs; here the width was frozen in constants.js and the art was
    // cropped to fit it. Packs that say nothing keep the old geometry, so nothing existing moves.
    const declared = pet?.atlas && typeof pet.atlas === "object" ? pet.atlas : {};
    geometry = {
      cellWidth: positiveInteger(declared.cellWidth, CELL_WIDTH),
      cellHeight: positiveInteger(declared.cellHeight, CELL_HEIGHT),
      columns: positiveInteger(declared.columns, 8)
    };
    const spriteVersionNumber = positiveInteger(pet?.spriteVersionNumber, 1);
    const standardAtlasHeight = (spriteVersionNumber >= 2 ? 11 : 9) * CELL_HEIGHT;
    const missingStates = new Set();
    states = {
      ...STATES,
      ...stateTimingOverrides(pet?.stateTimings, geometry.columns, missingStates),
      ...careConfig.states
    };
    // A state the pack has no art for is removed outright, so setState() refuses it and every
    // caller - the wander loop, the autonomous picker, the state dropdown - stops offering it.
    for (const id of missingStates) {
      if (!careConfig.states[id]) {
        delete states[id];
      }
    }
    if (!states[stateName]) {
      stateName = "idle";
    }
    stateLabels = {
      ...STATE_LABELS,
      ...Object.fromEntries(Object.entries(careConfig.states).map(([id, state]) => [id, state.label]))
    };
    sources = {
      standard: { url: standardSource, width: ATLAS_WIDTH, height: standardAtlasHeight || ATLAS_HEIGHT },
      care: { url: careSource, width: careConfig.atlas.width, height: careConfig.atlas.height }
    };
    // The atlas file itself is the truth about its size, not spriteVersionNumber. A pack whose
    // version number disagreed with the image (an 11-row atlas declared as version 1) was drawn
    // 1872px tall instead of 2288: the sprite got squashed, the rows drifted, and a slice of the
    // next row leaked in below, so the pet looked cut in two. Measure it and redraw the frame.
    measureAtlas(standardSource, "standard");
    measureAtlas(careSource, "care");
    renderStateOptions();
  }

  /// Load the atlas' real dimensions and redraw the frame when they differ from the declared ones.
  function measureAtlas(url, key) {
    if (!url || typeof Image === "undefined") {
      return;
    }
    const probe = new Image();
    probe.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = probe;
      const source = sources[key];
      // The pack may have changed while the image loaded: match the url so we never apply
      // measurements that belong to a different atlas.
      if (!width || !height || !source || source.url !== url) {
        return;
      }
      if (source.width === width && source.height === height) {
        return;
      }
      sources[key] = { url, width, height };
      setFrame();
    };
    probe.src = url;
  }

  function getCareStates() {
    return Object.entries(careConfig.states).map(([id, state]) => ({ id, ...state }));
  }

  function getCareState(id) {
    const state = careConfig.states[id];
    return state ? { id, ...state } : null;
  }

  function planAutonomousCare(random = Math.random) {
    if (!careConfig.autonomousStates.length || random() >= careConfig.autonomousChance) {
      return null;
    }
    const index = Math.min(
      Math.floor(random() * careConfig.autonomousStates.length),
      careConfig.autonomousStates.length - 1
    );
    const state = careConfig.autonomousStates[index];
    return { direction: 0, durationMs: careConfig.states[state].durationMs, kind: "care", state };
  }

  function animationLoop(now) {
    // the layer keeps its own tempo: hearts drift slower than the cat blinks
    overlayElapsedMs = now;
    setOverlayFrame();
    const state = states[stateName] || states.idle;
    if (state.timeline?.length) {
      if (!timelineStarted) {
        timelineStarted = true;
        lastFrameAt = now;
      } else {
        let changed = false;
        while (now - lastFrameAt >= state.timeline[timelineIndex].durationMs) {
          lastFrameAt += state.timeline[timelineIndex].durationMs;
          if (timelineIndex + 1 >= state.timeline.length) {
            if (state.once) {
              setState(onceReturnState);
              requestAnimationFrame(animationLoop);
              return;
            }
            timelineIndex = 0;
          } else {
            timelineIndex += 1;
          }
          frame = state.timeline[timelineIndex].frame;
          changed = true;
        }
        if (changed) {
          setFrame();
        }
      }
      requestAnimationFrame(animationLoop);
      return;
    }

    const delay = 1000 / state.fps;
    if (!lastFrameAt || now - lastFrameAt >= delay) {
      frame += 1;
      if (frame >= state.frames) {
        if (state.once) {
          setState(onceReturnState);
        } else {
          frame = 0;
        }
      }
      setFrame();
      lastFrameAt = now;
    }
    requestAnimationFrame(animationLoop);
  }

  return {
    animationLoop,
    configurePet,
    /// The cell the ACTIVE pack draws in. The window must be sized from this and not from the
    /// app-wide constant: a pack with a wider cell would otherwise be cropped by its own frame.
    geometry: () => ({ ...geometry }),
    getCareState,
    getCareStates,
    planAutonomousCare,
    renderStateOptions,
    setDirection,
    setState
  };
}
