#!/usr/bin/env node

import { createAnimation, normalizeCareConfig } from "./app/renderer/animation.js";

const care = {
  atlas: { width: 1536, height: 1040, columns: 8, rows: 5, cellWidth: 192, cellHeight: 208 },
  states: {
    play: { label: "Игра", row: 3, frames: 6, fps: 7, durationMs: 5000, mirror: false },
    idle: { label: "Нельзя заменить", row: 0, frames: 6, fps: 5 },
    broken: { row: 99, frames: 12, fps: 0 }
  },
  autonomousStates: ["play", "missing"],
  autonomousChance: 0.25
};

const normalized = normalizeCareConfig(care);
if (
  Object.keys(normalized.states).join(",") !== "play" ||
  normalized.autonomousStates.join(",") !== "play" ||
  normalized.autonomousChance !== 0.25
) {
  throw new Error(`Unexpected normalized care config: ${JSON.stringify(normalized)}`);
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
if (autonomous?.state !== "play" || autonomous.durationMs !== 5000) {
  throw new Error(`Unexpected autonomous care plan: ${JSON.stringify(autonomous)}`);
}

console.log("renderer care states smoke passed");
