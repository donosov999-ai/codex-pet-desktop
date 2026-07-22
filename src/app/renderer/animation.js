import { ATLAS_HEIGHT, ATLAS_WIDTH, CELL_HEIGHT, CELL_WIDTH, STATES, STATE_LABELS } from "./constants.js";

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(finiteNumber(value, fallback));
  return number > 0 ? number : fallback;
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
    states[id] = {
      atlas: "care",
      row,
      frames,
      fps,
      once: raw.once === true,
      mirror: raw.mirror !== false,
      durationMs: Math.max(1000, finiteNumber(raw.durationMs, 6000)),
      label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : id
    };
  }

  const autonomousStates = Array.isArray(source.autonomousStates)
    ? source.autonomousStates.filter((id) => states[id])
    : [];
  const autonomousChance = Math.min(Math.max(finiteNumber(source.autonomousChance, 0), 0), 1);

  return { atlas, states, autonomousStates, autonomousChance };
}

export function createAnimation(dom) {
  let states = { ...STATES };
  let stateLabels = { ...STATE_LABELS };
  let careConfig = normalizeCareConfig();
  let sources = {
    standard: { url: "", width: ATLAS_WIDTH, height: ATLAS_HEIGHT },
    care: { url: "", width: 0, height: 0 }
  };
  let stateName = "idle";
  let manualDirection = "right";
  let frame = 0;
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
    const cellWidth = state.atlas === "care" ? careConfig.atlas.cellWidth : CELL_WIDTH;
    const cellHeight = state.atlas === "care" ? careConfig.atlas.cellHeight : CELL_HEIGHT;
    const x = -(frame % state.frames) * cellWidth;
    const y = -state.row * cellHeight;
    dom.petEl.style.backgroundImage = source.url ? `url("${source.url}")` : "";
    dom.petEl.style.backgroundSize = `${source.width}px ${source.height}px`;
    dom.petEl.style.backgroundPosition = `${x}px ${y}px`;
  }

  function setState(nextState, { onceReturn = "idle" } = {}) {
    if (!states[nextState]) {
      return false;
    }
    stateName = nextState;
    frame = 0;
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

  function configurePet(pet, { standardSource = "", careSource = "" } = {}) {
    careConfig = normalizeCareConfig(careSource ? pet?.care : {});
    states = { ...STATES, ...careConfig.states };
    stateLabels = {
      ...STATE_LABELS,
      ...Object.fromEntries(Object.entries(careConfig.states).map(([id, state]) => [id, state.label]))
    };
    sources = {
      standard: { url: standardSource, width: ATLAS_WIDTH, height: ATLAS_HEIGHT },
      care: { url: careSource, width: careConfig.atlas.width, height: careConfig.atlas.height }
    };
    renderStateOptions();
  }

  function getCareStates() {
    return Object.entries(careConfig.states).map(([id, state]) => ({ id, ...state }));
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
    return { direction: 0, durationMs: careConfig.states[state].durationMs, state };
  }

  function animationLoop(now) {
    const state = states[stateName] || states.idle;
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
    getCareStates,
    planAutonomousCare,
    renderStateOptions,
    setDirection,
    setState
  };
}
