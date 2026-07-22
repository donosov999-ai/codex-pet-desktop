#!/usr/bin/env node

import fs from "node:fs";
import { createAnimation, normalizeCareConfig } from "./app/renderer/animation.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../resources/pets/biruzik/pet.json", import.meta.url), "utf8"));
const care = manifest.care;
const normalized = normalizeCareConfig(care);
const expectedTimings = {
  sleep: { fps: 2, loops: 1, durationMs: 60000 },
  eat: { fps: 3, loops: 12, durationMs: 24000 },
  wash: { fps: 3, loops: 12, durationMs: 24000 },
  play: { fps: 2.5, loops: 1, durationMs: 24000 },
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
  if (!state.timeline) {
    const completeCycleDuration = Math.round((state.frames / state.fps) * 1000 * state.loops);
    if (state.durationMs !== completeCycleDuration) {
      throw new Error(`${stateId} must finish after complete animation cycles`);
    }
  }
}

const sleepTimeline = normalized.states.sleep.timeline;
const playTimeline = normalized.states.play.timeline;
if (!sleepTimeline || sleepTimeline.length !== 51 || sleepTimeline.reduce((sum, step) => sum + step.durationMs, 0) !== 60000) {
  throw new Error(`Sleep must enter once, breathe while asleep, and wake once: ${JSON.stringify(sleepTimeline)}`);
}
if (
  JSON.stringify(sleepTimeline.slice(0, 6).map((step) => step.frame)) !== JSON.stringify([0, 1, 2, 2, 3, 2]) ||
  JSON.stringify(sleepTimeline.slice(-5).map((step) => step.frame)) !== JSON.stringify([3, 2, 3, 4, 5])
) {
  throw new Error(`Unexpected sleep frame order: ${JSON.stringify(sleepTimeline.map((step) => step.frame))}`);
}
if (!playTimeline || playTimeline.length !== 60 || playTimeline.reduce((sum, step) => sum + step.durationMs, 0) !== 24000) {
  throw new Error(`Play must use six slow ping-pong cycles: ${JSON.stringify(playTimeline)}`);
}
if (JSON.stringify(playTimeline.slice(0, 10).map((step) => step.frame)) !== JSON.stringify([0, 1, 2, 3, 4, 5, 4, 3, 2, 1])) {
  throw new Error(`Unexpected play frame order: ${JSON.stringify(playTimeline.map((step) => step.frame))}`);
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
globalThis.requestAnimationFrame = () => 1;
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
  { care, spriteVersionNumber: 2 },
  { standardSource: "asset://standard", careSource: "asset://care" }
);
animation.setState("idle");
if (style.backgroundImage !== 'url("asset://standard")' || style.backgroundSize !== "1536px 2288px") {
  throw new Error(`V2 standard atlas was rendered with the wrong dimensions: ${JSON.stringify(style)}`);
}
if (!animation.setState("play")) {
  throw new Error("Care state was not registered");
}
if (style.backgroundImage !== 'url("asset://care")' || style.backgroundSize !== "1536px 1040px") {
  throw new Error(`Care atlas was not selected: ${JSON.stringify(style)}`);
}
animation.setState("sleep");
animation.animationLoop(100);
if (style.backgroundPosition !== "0px 0px") {
  throw new Error(`Sleep must hold its first frame before advancing: ${style.backgroundPosition}`);
}
animation.animationLoop(600);
if (style.backgroundPosition !== "-192px 0px") {
  throw new Error(`Sleep entry did not advance to frame 1: ${style.backgroundPosition}`);
}
animation.animationLoop(1600);
if (style.backgroundPosition !== "-384px 0px") {
  throw new Error(`Sleep did not enter the breathing loop: ${style.backgroundPosition}`);
}
animation.animationLoop(59100);
if (style.backgroundPosition !== "-768px 0px") {
  throw new Error(`Sleep did not wait until the end before waking: ${style.backgroundPosition}`);
}
animation.animationLoop(59600);
if (style.backgroundPosition !== "-960px 0px") {
  throw new Error(`Sleep did not finish on the wake frame: ${style.backgroundPosition}`);
}
animation.setState("play");
animation.animationLoop(100000);
animation.animationLoop(102000);
if (style.backgroundPosition !== "-960px -624px") {
  throw new Error(`Play did not reach the ball-return frame at the slower cadence: ${style.backgroundPosition}`);
}
animation.animationLoop(102400);
if (style.backgroundPosition !== "-768px -624px") {
  throw new Error(`Play must reverse smoothly instead of snapping to frame 0: ${style.backgroundPosition}`);
}
const randomValues = [0.1, 0];
const autonomous = animation.planAutonomousCare(() => randomValues.shift());
if (autonomous?.state !== "play" || autonomous.durationMs !== 24000 || autonomous.kind !== "care") {
  throw new Error(`Unexpected autonomous care plan: ${JSON.stringify(autonomous)}`);
}

console.log(JSON.stringify({ ok: true, timings: expectedTimings }, null, 2));
