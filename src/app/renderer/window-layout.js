import { CELL_HEIGHT, CELL_WIDTH } from "./constants.js";

const MIN_PET_WINDOW_WIDTH = 180;
const MIN_PET_WINDOW_HEIGHT = 200;
const MAX_PET_WINDOW_WIDTH = 460;
const MAX_PET_WINDOW_HEIGHT = 520;
const PET_PADDING_X = 72;
const PET_PADDING_Y = 76;
/// How far the pet's feet sit above the bottom of its window.
///
/// The pet box is anchored to the bottom of the stage (see #stage in renderer.css) and the sprite
/// scales from its bottom edge, so this one number fixes the whole vertical layout: the feet are
/// always FLOOR_GAP from the frame, and whatever the scale adds goes upward into the window.
/// Half of PET_PADDING_Y below, the other half stays as clear space above the head.
export const FLOOR_GAP = PET_PADDING_Y / 2;
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
    // Height is the drawn sprite plus its margins, because the pet is anchored to the bottom of
    // the stage: the feet stay FLOOR_GAP above the frame and everything the scale adds goes up
    // into the window, leaving the same clear space above the head at every size.
    // ⚠️ This only holds WITH the bottom anchor. While the box was centred and the sprite scaled
    // from its bottom edge, the same formula cut the head off at large sizes — the room was there
    // in total but half of it sat under the feet. Widening the height to cover that
    // (CELL_HEIGHT * (2 * scale - 1)) removed the clipping and left 205px of dead space below the
    // pet at the slider's maximum, measured on the dev preview. Anchoring fixes both, so the
    // formula can stay simple; if the anchor ever goes back to centred, this must change with it.
    height: clamp(Math.ceil(CELL_HEIGHT * safeScale + PET_PADDING_Y), MIN_PET_WINDOW_HEIGHT, MAX_PET_WINDOW_HEIGHT)
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
    // The baseline the shell keeps still while the window resizes: the pet's feet. With the box
    // anchored to the bottom of the stage that is simply the frame minus the floor gap, at any
    // scale. The previous formula derived it from a centred box and then added half the SCALED
    // height, which describes neither the old layout (the bottom did not move with scale, the
    // origin is bottom) nor the new one.
    return {
      x: size.width / 2 + (visiblePanel ? (PANEL_WIDTH + PANEL_GAP) / 2 : 0),
      y: size.height - FLOOR_GAP
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
