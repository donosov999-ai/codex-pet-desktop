import { CELL_HEIGHT, CELL_WIDTH } from "./constants.js";

const MIN_PET_WINDOW_WIDTH = 180;
const MIN_PET_WINDOW_HEIGHT = 200;
const MAX_PET_WINDOW_WIDTH = 460;
// Fits the slider's maximum (1.8) under the formula below: 208 * 2.6 + 76 = 617.
const MAX_PET_WINDOW_HEIGHT = 620;
const PET_PADDING_X = 72;
const PET_PADDING_Y = 76;
const PANEL_WIDTH = 300;
const PANEL_GAP = 20;
const PANEL_PADDING_X = 48;
const MAX_PANEL_WITH_PET_WINDOW_WIDTH = 760;
const EMPTY_WINDOW = { width: 320, height: 300 };
const PANEL_WINDOW = { width: 350, height: 440 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/// Size-based growth used to live here: the pet was drawn from 0.7x to 1.3x as care accumulated,
/// and both the sprite and the window followed that number. The owner rejected the model on
/// 2026-08-16 — the same drawing getting larger reads as a zoom, not as progress — and growth is
/// now a change of named form at a fixed size (see renderer/growth-layer.js). The function is
/// removed rather than left unused: a helper that still says "the pet grows to 1.3x" is an
/// invitation to wire it back in, and a window that quietly inflates by a third around a pet that
/// never grew is worse than no growth at all.

function normalizedScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value) || value <= 0) {
    return 0.9;
  }
  return clamp(value, 0.4, 2.2);
}

export function desiredWindowSize({ scale = 0.9, hasPet = false, panelVisible = false } = {}) {
  if (panelVisible) {
    if (hasPet) {
      const safeScale = normalizedScale(scale);
      return {
        width: clamp(
          Math.ceil(PANEL_WIDTH + PANEL_GAP + CELL_WIDTH * safeScale + PANEL_PADDING_X),
          520,
          MAX_PANEL_WITH_PET_WINDOW_WIDTH
        ),
        height: clamp(
          Math.ceil(Math.max(PANEL_WINDOW.height, CELL_HEIGHT * safeScale + PET_PADDING_Y)),
          PANEL_WINDOW.height,
          MAX_PET_WINDOW_HEIGHT
        )
      };
    }
    return PANEL_WINDOW;
  }
  if (!hasPet) {
    return EMPTY_WINDOW;
  }
  const safeScale = normalizedScale(scale);
  return {
    width: clamp(Math.ceil(CELL_WIDTH * safeScale + PET_PADDING_X), MIN_PET_WINDOW_WIDTH, MAX_PET_WINDOW_WIDTH),
    // 🔴 THE PET GROWS UPWARDS, AND THE HEIGHT HAS TO SAY SO.
    // #pet has `transform-origin: center bottom`, so scaling keeps the feet on their line and
    // pushes the head up. The box itself is centred in the window, so the head leaves the window
    // long before the total height runs out: at the slider's maximum of 1.8 the top sat 45px
    // ABOVE the frame and was cut off. Height must cover the centred box plus everything the
    // scale adds above it, which is CELL_HEIGHT * (2 * scale - 1), not CELL_HEIGHT * scale.
    // This was masked until now: care growth started every pet at 0.7 of the slider, so nobody
    // reached a scale where the clipping showed. With size-based growth gone the mask went too.
    height: clamp(Math.ceil(CELL_HEIGHT * (2 * safeScale - 1) + PET_PADDING_Y), MIN_PET_WINDOW_HEIGHT, MAX_PET_WINDOW_HEIGHT)
  };
}

export function createWindowLayout({ dom, petDesktop, state }) {
  let lastSignature = "";
  let lastPetAnchor = null;

  function hasPet() {
    return Boolean(state.activePet && state.pets.some((pet) => pet.id === state.activePet.id));
  }

  function panelVisible() {
    return !dom.panelEl.classList.contains("hidden");
  }

  function petAnchor(size, visiblePanel, scale) {
    if (!hasPet()) {
      return null;
    }
    return {
      x: size.width / 2 + (visiblePanel ? (PANEL_WIDTH + PANEL_GAP) / 2 : 0),
      y: size.height / 2 + (CELL_HEIGHT * normalizedScale(scale)) / 2
    };
  }

  async function syncWindowLayout({ centerIfEmpty = false, panelVisibleOverride } = {}) {
    if (!petDesktop?.resizeWindow) {
      return;
    }
    const visiblePanel = typeof panelVisibleOverride === "boolean" ? panelVisibleOverride : panelVisible();
    // The window follows the SLIDER only. It used to multiply by growthFactor() because the pet
    // was drawn up to 1.3x as care accumulated, so the window had to keep up or clip his head.
    // That size-based growth is gone (see growth-layer.js): the pet now advances through named
    // forms at a fixed size. Leaving the multiplier in would inflate the window by up to a third
    // around a pet that never grew into it — empty space appearing for no visible reason, and
    // the longer someone cared for the pet the worse it got.
    const scale = normalizedScale(Number(dom.scaleRange.value) || state.preferences.scale || 0.9);
    const size = desiredWindowSize({
      scale,
      hasPet: hasPet(),
      panelVisible: visiblePanel
    });
    const hasActivePet = hasPet();
    const nextPetAnchor = petAnchor(size, visiblePanel, scale);
    const signature = `${size.width}x${size.height}:${hasActivePet ? "pet" : "empty"}:${visiblePanel ? "panel" : "plain"}`;
    if (signature === lastSignature) {
      if (centerIfEmpty && !hasPet()) {
        await petDesktop.centerPosition?.();
      }
      return;
    }
    lastSignature = signature;
    const anchor = lastPetAnchor && nextPetAnchor ? { current: lastPetAnchor, next: nextPetAnchor } : undefined;
    await petDesktop.resizeWindow(size.width, size.height, anchor);
    lastPetAnchor = nextPetAnchor;
    if (centerIfEmpty && !hasPet()) {
      await petDesktop.centerPosition?.();
    }
  }

  return {
    syncWindowLayout
  };
}
