#!/usr/bin/env node

import fs from "node:fs";
import { createAnimation, normalizeCareConfig } from "./app/renderer/animation.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../resources/pets/biruzik/pet.json", import.meta.url), "utf8"));
const care = manifest.care;
const normalized = normalizeCareConfig(care);
const expectedTimings = {
  sleep: { fps: 2, loops: 20, durationMs: 60000 },
  eat: { fps: 3, loops: 12, durationMs: 24000 },
  wash: { fps: 3, loops: 12, durationMs: 24000 },
  play: { fps: 5, loops: 15, durationMs: 18000 },
  toilet: { fps: 3, loops: 6, durationMs: 12000 }
};

for (const [stateId, expected] of Object.entries(expectedTimings)) {
  const state = normalized.states[stateId];
  if (!state) {
    throw new Error(`Missing care state: ${stateId}`);
  }
  if (state.fps !== expected.fps || state.loops !== expected.loops || state.durationMs !== expected.durationMs) {
    throw new Error(`Unexpected ${stateId} timing: ${JSON.stringify(state)}`);
  }
  const completeCycleDuration = Math.round((state.frames / state.fps) * 1000 * state.loops);
  if (state.durationMs !== completeCycleDuration) {
    throw new Error(`${stateId} must finish after complete animation cycles`);
  }
}

const invalid = normalizeCareConfig({
  atlas: care.atlas,
  states: {
    idle: { row: 0, frames: 6, fps: 5 },
    broken: { row: 99, frames: 12, fps: 0 }
  },
  autonomousStates: ["broken"],
  autonomousChance: 2
});
if (Object.keys(invalid.states).length !== 0 || invalid.autonomousStates.length !== 0 || invalid.autonomousChance !== 1) {
  throw new Error(`Invalid care config was not rejected: ${JSON.stringify(invalid)}`);
}

globalThis.document = {
  createElement: () => ({ value: "", textContent: "" })
};
const style = {
  backgroundImage: "",
  backgroundPosition: "",
  backgroundSize: "",
  setProperty() {}
};
const stateSelect = {
  value: "",
  replaceChildren(...options) {
    this.options = options;
  }
};
const animation = createAnimation({ petEl: { style }, stateSelect });
animation.configurePet(
  { care },
  { standardSource: "asset://standard", careSource: "asset://care" }
);
if (!animation.setState("play")) {
  throw new Error("Care state was not registered");
}
if (style.backgroundImage !== 'url("asset://care")' || style.backgroundSize !== "1536px 1040px") {
  throw new Error(`Care atlas was not selected: ${JSON.stringify(style)}`);
}
const randomValues = [0.1, 0];
const autonomous = animation.planAutonomousCare(() => randomValues.shift());
if (autonomous?.state !== "play" || autonomous.durationMs !== 18000 || autonomous.kind !== "care") {
  throw new Error(`Unexpected autonomous care plan: ${JSON.stringify(autonomous)}`);
}

console.log(JSON.stringify({ ok: true, timings: expectedTimings }, null, 2));
