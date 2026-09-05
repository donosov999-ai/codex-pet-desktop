import { activeBehavior, createLifeEngine } from "./life-engine.js";

export function createInteractions({
  animation,
  dom,
  onCare = () => {},
  onLayoutChange = () => {},
  petDesktop,
  state
}) {
  let dragging = false;
  let pointerInsideInteractiveArea = false;
  let dragLastScreenX = 0;
  let dragLastScreenY = 0;
  let movedDuringDrag = false;
  let suppressNextClick = false;
  let wanderTimer = 0;
  let wanderDirection = 0;
  let wanderUntil = 0;
  let activeCareState = "";
  let careUntil = 0;
  let lastQuietState = "";
  let edgePaused = false;
  let preferredNextDirection = 0;
  let mousePassthrough = null;
  let moveInFlight = false;
  let lastMoveAt = 0;
  let moveRemainder = 0;
  // Share of its own width the pet covers in one walk cycle. Lower and it minces on the spot,
  // higher and it skates. 0.55 was chosen by eye on the packs that have a real walk drawn.
  const STRIDE_SHARE = 0.55;
  let panelVisibilityRevision = 0;
  const lifeEngine = createLifeEngine({
    behavior: state.activePet?.behavior,
    preferences: state.preferences
  });

  function hasActivePet() {
    return Boolean(state.activePet && state.pets.some((pet) => pet.id === state.activePet.id));
  }

  function refreshLifeEngine() {
    const behavior = state.activePet?.behavior || {};
    lifeEngine.update({
      behavior,
      preferences: state.preferences || {}
    });
    return activeBehavior(behavior);
  }

  function naturalLifeEnabled() {
    return state.preferences?.naturalLife !== false;
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

  function legacyWanderPlan(behavior) {
    const directions = behavior.wanderDirections;
    const direction = directions.includes(preferredNextDirection)
      ? preferredNextDirection
      : pick(directions);
    const stateName = direction < 0 ? "running-left" : direction > 0 ? "running-right" : pickQuietState(behavior);
    return {
      direction,
      durationMs: randomDuration(direction === 0 ? behavior.natural.idleDurationMs : behavior.natural.walkDurationMs),
      state: stateName
    };
  }

  function applyWanderPlan(plan) {
    if (!plan) {
      return false;
    }
    if (plan.kind === "care") {
      return playCareAction(plan.state, plan.durationMs);
    }
    activeCareState = "";
    careUntil = 0;
    wanderDirection = plan.direction || 0;
    preferredNextDirection = 0;
    edgePaused = false;
    wanderUntil = performance.now() + plan.durationMs;
    animation.setState(plan.state, plan.onceReturn ? { onceReturn: plan.onceReturn } : undefined);
    return true;
  }

  function preferEdgeRecoveryDirection(plan, behavior) {
    if (!plan || !preferredNextDirection) {
      return plan;
    }
    const phase = lifeEngine.phase();
    const directions = phase?.wanderDirections || behavior.wanderDirections;
    if (!directions.includes(preferredNextDirection)) {
      return plan;
    }
    return {
      ...plan,
      direction: preferredNextDirection,
      durationMs: randomDuration(phase?.walkDurationMs || behavior.natural.walkDurationMs),
      state: preferredNextDirection < 0 ? "running-left" : "running-right"
    };
  }

  function panelOpen() {
    return dom.panelEl.classList.contains("hidden") === false;
  }

  function afterNextPaint(callback) {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  }

  function isWindowsRuntime() {
    const platform = state.appInfo.platform || globalThis.navigator?.platform || "";
    return /win/i.test(platform);
  }

  function setMousePassthrough(ignored) {
    // 🔴 CLICK-THROUGH IS A ONE-WAY DOOR AND IS THEREFORE NOT ENTERED.
    //
    // set_ignore_cursor_events(true) makes the OS route every pointer event to whatever is behind
    // the window, so the webview stops receiving mouse events entirely. The only code that turns
    // it back off is updateMousePassthrough, which is driven by `document` mousemove — an event
    // that can no longer arrive. index.js called setMousePassthrough(true) during boot, so on
    // macOS the pet became unclickable and undraggable the moment the app started, for good.
    // Windows was already exempted here; the exemption was the accident that kept it usable.
    //
    // Until the position of the cursor can be polled from Rust — the only source that works while
    // the window is transparent to the pointer — the honest behaviour is the one Windows has: the
    // window keeps its events, and the cost is that its rectangle catches clicks. A pet you cannot
    // touch is worse than a small rectangle that catches them.
    void ignored;
    const nextIgnored = false;
    if (mousePassthrough === nextIgnored) {
      return;
    }
    mousePassthrough = nextIgnored;
    petDesktop?.setIgnoreMouseEvents(nextIgnored);
  }

  function isInteractiveTarget(target) {
    return Boolean(target?.closest?.("#pet, #emptyState, #panel"));
  }

  function updateMousePassthrough(event) {
    const shouldReceiveMouse = dragging || isInteractiveTarget(event.target);
    if (pointerInsideInteractiveArea === shouldReceiveMouse) {
      return;
    }
    pointerInsideInteractiveArea = shouldReceiveMouse;
    setMousePassthrough(!shouldReceiveMouse);
  }

  function stopWander() {
    wanderDirection = 0;
    wanderUntil = 0;
    edgePaused = false;
    preferredNextDirection = 0;
    window.clearTimeout(wanderTimer);
  }

  function careActive(now = performance.now()) {
    return Boolean(activeCareState && careUntil > now);
  }

  function cancelCareAction({ resetState = false } = {}) {
    const wasActive = Boolean(activeCareState || careUntil);
    activeCareState = "";
    careUntil = 0;
    if (wasActive && resetState) {
      animation.setState("idle");
    }
  }

  function scheduleWander(delayOverride) {
    window.clearTimeout(wanderTimer);
    if (!hasActivePet()) {
      wanderDirection = 0;
      wanderUntil = 0;
      edgePaused = false;
      preferredNextDirection = 0;
      return;
    }
    if (careActive()) {
      wanderTimer = window.setTimeout(() => scheduleWander(), Math.max(250, careUntil - performance.now() + 50));
      return;
    }
    const behavior = refreshLifeEngine();
    const autonomousPlan = naturalLifeEnabled()
      ? lifeEngine.planAutonomous({
          autoWander: Boolean(dom.wanderToggle.checked),
          dragging,
          panelOpen: panelOpen()
        })
      : null;
    const delay = Number.isFinite(delayOverride)
      ? delayOverride
      : autonomousPlan?.nextDelayMs ?? randomDuration(behavior.natural.nextWanderDelayMs);
    wanderTimer = window.setTimeout(() => {
      if (
        !hasActivePet() ||
        !dom.wanderToggle.checked ||
        dragging ||
        pointerInsideInteractiveArea ||
        panelOpen()
      ) {
        scheduleWander();
        return;
      }
      const currentBehavior = refreshLifeEngine();
      const carePlan = naturalLifeEnabled() ? animation.planAutonomousCare?.() : null;
      const plan = naturalLifeEnabled()
        ? lifeEngine.planAutonomous({
            autoWander: Boolean(dom.wanderToggle.checked),
            dragging,
            panelOpen: panelOpen()
          })
        : null;
      if (
        !applyWanderPlan(
          carePlan || preferEdgeRecoveryDirection(plan, currentBehavior) || legacyWanderPlan(currentBehavior)
        )
      ) {
        scheduleWander();
      }
    }, delay);
  }

  function wanderLoop(now) {
    if (activeCareState) {
      if (now >= careUntil) {
        activeCareState = "";
        careUntil = 0;
        animation.setState("idle");
        scheduleWander();
      }
      requestAnimationFrame(wanderLoop);
      return;
    }
    if (
      hasActivePet() &&
      wanderDirection !== 0 &&
      now < wanderUntil &&
      dom.wanderToggle.checked &&
      !dragging &&
      !pointerInsideInteractiveArea &&
      !panelOpen() &&
      !moveInFlight
    ) {
      moveInFlight = true;
      // 🔴 STEP BY TIME, NOT BY CALL.
      //
      // This was moveBy(direction, 0): exactly one pixel per round trip to the window, so the pet's
      // speed was set by how fast the bridge answers rather than by how fast its legs move. On a
      // quick machine that is a sprint, on a loaded one a crawl, and either way the feet live
      // apart from the ground. The speed now comes from the pack's own walk cycle: one cycle
      // carries the figure a fixed share of its width, so the planted foot looks planted. The
      // fractional remainder is carried over, otherwise a sub-pixel step always rounds to zero and
      // the pet never moves at all.
      const nowMs = performance.now();
      const seconds = lastMoveAt ? Math.min(0.12, (nowMs - lastMoveAt) / 1000) : 0.016;
      lastMoveAt = nowMs;
      const cell = animation.geometry?.() || {};
      const bodyWidth = (cell.cellWidth || 192) * (Number(dom.scaleRange?.value) || 0.9);
      const speed = (bodyWidth * STRIDE_SHARE) / animation.walkCycleSeconds();
      moveRemainder += speed * seconds * wanderDirection;
      const step = Math.trunc(moveRemainder);
      moveRemainder -= step;
      // ⚠️ NO EARLY RETURN HERE. The next frame is requested at the very end of this function, so a
      // `return` on this branch would mean requestAnimationFrame is never called again: the pet
      // freezes for good, and only on fast machines, where the step is most often below a pixel.
      // A zero step therefore skips the move, it does not leave the loop.
      Promise.resolve(step ? petDesktop?.moveBy(step, 0) : null)
        .then((bounds) => {
          if (bounds?.hitEdge === "left") {
            const behavior = refreshLifeEngine();
            wanderDirection = 0;
            preferredNextDirection = 1;
            edgePaused = true;
            wanderUntil = performance.now() + randomDuration(behavior.natural.edgePauseMs);
            animation.setState(pick(behavior.natural.edgePauseStates));
          } else if (bounds?.hitEdge === "right") {
            const behavior = refreshLifeEngine();
            wanderDirection = 0;
            preferredNextDirection = -1;
            edgePaused = true;
            wanderUntil = performance.now() + randomDuration(behavior.natural.edgePauseMs);
            animation.setState(pick(behavior.natural.edgePauseStates));
          }
        })
        .catch(() => {})
        .finally(() => {
          moveInFlight = false;
        });
    }
    if (wanderUntil && now >= wanderUntil) {
      wanderDirection = 0;
      wanderUntil = 0;
      animation.setState(edgePaused ? "idle" : pickQuietState(refreshLifeEngine()));
      edgePaused = false;
      scheduleWander();
    }
    requestAnimationFrame(wanderLoop);
  }

  /// Quick care menu: the short list of things you can do for the pet, right where you clicked.
  ///
  /// It deliberately carries only care actions. Settings, catalog and updates stay on the right
  /// click — those are about the app, this is about the animal.
  let careMenuEl = null;

  function hideCareMenu() {
    careMenuEl?.remove();
    careMenuEl = null;
  }

  function showCareMenu() {
    hideCareMenu();
    const careStates = animation.getCareStates?.() || [];
    if (!careStates.length) {
      return;
    }
    careMenuEl = document.createElement("div");
    careMenuEl.className = "care-menu";
    careMenuEl.setAttribute("role", "menu");
    careMenuEl.replaceChildren(
      ...careStates.map((careState) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.dataset.careState = careState.id;
        button.textContent = careState.label;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          hideCareMenu();
          playCareAction(careState.id, careState.durationMs);
        });
        return button;
      })
    );
    document.body.appendChild(careMenuEl);
    // Sit above the pet when there is room, below it otherwise: the window is small and the menu
    // must not hang off the screen.
    const pet = dom.petEl.getBoundingClientRect();
    // The window is 320x340 and the menu can hold fourteen care states, so it does not always fit.
    // Cap it to the window and let it scroll; measure only AFTER capping, otherwise the height used
    // for placement is the uncapped one and the maths below is off by however much overflowed.
    careMenuEl.style.maxHeight = `${Math.max(96, window.innerHeight - 8)}px`;
    careMenuEl.style.overflowY = "auto";
    const menu = careMenuEl.getBoundingClientRect();
    const above = pet.top - menu.height - 8;
    careMenuEl.style.left = `${Math.max(4, Math.min(pet.left + pet.width / 2 - menu.width / 2, window.innerWidth - menu.width - 4))}px`;
    // Math.max(4, ...) on the vertical too. Without it a menu taller than the window got a
    // NEGATIVE top and its first rows were cut off above the window edge. The horizontal axis
    // had this clamp from the start, the vertical one did not, and that asymmetry was the bug.
    careMenuEl.style.top = `${Math.max(4, above >= 4 ? above : Math.min(pet.bottom + 8, window.innerHeight - menu.height - 4))}px`;
  }

  function playCareAction(stateName, durationMs) {
    stopWander();
    const careState = animation.getCareState?.(stateName);
    if (!careState || !animation.setState(stateName)) {
      scheduleWander();
      return false;
    }
    wanderDirection = 0;
    edgePaused = false;
    activeCareState = stateName;
    onCare?.();
    careUntil = performance.now() + Math.max(1000, Number(careState.durationMs) || Number(durationMs) || 6000);
    return true;
  }

  function finalizePanelClosed() {
    dom.panelEl.classList.add("hidden");
    dom.panelBackdropEl.classList.add("hidden");
    dom.emptyStateEl.classList.toggle("hidden", hasActivePet());
    document.documentElement.classList.remove("panel-open");
    document.documentElement.classList.remove("panel-with-pet");
    document.documentElement.classList.remove("panel-closing");
  }

  function setPanelVisible(show) {
    const revision = ++panelVisibilityRevision;
    if (show) {
      stopWander();
      if (!careActive()) {
        animation.setState("idle");
      }
      dom.panelEl.classList.remove("hidden");
      dom.panelBackdropEl.classList.remove("hidden");
      dom.emptyStateEl.classList.toggle("hidden", true);
      document.documentElement.classList.add("panel-open");
      document.documentElement.classList.toggle("panel-with-pet", hasActivePet());
      document.documentElement.classList.remove("panel-closing");
      setMousePassthrough(false);
      onLayoutChange({ centerIfEmpty: false }).catch?.(() => {});
      return;
    }

    setMousePassthrough(false);
    if (panelOpen() && hasActivePet()) {
      dom.panelBackdropEl.classList.add("hidden");
      document.documentElement.classList.add("panel-closing");
      afterNextPaint(() => {
        if (revision !== panelVisibilityRevision) {
          return;
        }
        onLayoutChange({ panelVisibleOverride: false })
          .then(() => {
            if (revision === panelVisibilityRevision) {
              finalizePanelClosed();
            }
          })
          .catch(() => {});
      });
      return;
    }

    finalizePanelClosed();
    onLayoutChange({ centerIfEmpty: !hasActivePet() }).catch?.(() => {});
  }

  function togglePanel(show = dom.panelEl.classList.contains("hidden")) {
    setPanelVisible(show);
  }

  function bind({ pickPet }) {
    dom.petEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      stopWander();
      cancelCareAction();
      dragging = true;
      movedDuringDrag = false;
      pointerInsideInteractiveArea = true;
      dragLastScreenX = event.screenX;
      dragLastScreenY = event.screenY;
      setMousePassthrough(false);
      dom.petEl.setPointerCapture?.(event.pointerId);
    });

    dom.petEl.addEventListener("pointerenter", () => {
      if (dragging || panelOpen()) {
        return;
      }
      pointerInsideInteractiveArea = true;
      stopWander();
      if (!careActive()) {
        animation.setState("idle");
      }
      setMousePassthrough(false);
    });

    dom.petEl.addEventListener("pointerleave", () => {
      if (dragging || panelOpen()) {
        return;
      }
      pointerInsideInteractiveArea = false;
      scheduleWander(900);
      setMousePassthrough(false);
    });

    dom.petEl.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }
      const deltaX = event.screenX - dragLastScreenX;
      const deltaY = event.screenY - dragLastScreenY;
      dragLastScreenX = event.screenX;
      dragLastScreenY = event.screenY;
      if (deltaX || deltaY) {
        movedDuringDrag = true;
        petDesktop?.moveBy(deltaX, deltaY);
      }
    });

    function finishDrag(event) {
      if (!dragging) {
        return;
      }
      dragging = false;
      dom.petEl.releasePointerCapture?.(event.pointerId);
      if (movedDuringDrag && hasActivePet()) {
        const behavior = refreshLifeEngine();
        const plan = naturalLifeEnabled() ? lifeEngine.planInteraction("dragEnd") : null;
        suppressNextClick = true;
        if (plan) {
          animation.setState(plan.state || behavior.natural.postDragState, {
            onceReturn: plan.onceReturn || behavior.natural.postDragState
          });
        } else {
          animation.setState(behavior.natural.postDragState);
        }
        scheduleWander(plan?.durationMs ?? behavior.natural.postDragMs);
      } else {
        scheduleWander();
      }
      movedDuringDrag = false;
    }

    dom.petEl.addEventListener("pointerup", finishDrag);
    dom.petEl.addEventListener("pointercancel", finishDrag);
    dom.petEl.addEventListener("lostpointercapture", () => {
      if (dragging) {
        dragging = false;
        movedDuringDrag = false;
        scheduleWander();
      }
    });
    dom.petEl.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (dragging || !dom.panelEl.classList.contains("hidden")) {
        return;
      }
      cancelCareAction();
      const behavior = refreshLifeEngine();
      const plan = lifeEngine.planInteraction("click");
      animation.setState(plan?.state || behavior.clickState, {
        onceReturn: plan?.onceReturn || behavior.natural.clickReturnState
      });
      // Left click is for looking after the pet, right click is for settings. Mixing both into one
      // panel made every "let me feed it" go through a settings window, which is backwards for a
      // creature you are supposed to care for.
      showCareMenu();
    });
    dom.petEl.addEventListener("dblclick", () => {
      cancelCareAction();
      const behavior = refreshLifeEngine();
      const plan = lifeEngine.planInteraction("doubleClick");
      if ((animation.getCareStates?.() || []).length > 0) {
        togglePanel(true);
      }
      animation.setState(plan?.state || behavior.doubleClickState, {
        onceReturn: plan?.onceReturn || behavior.natural.doubleClickReturnState
      });
    });

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      hideCareMenu();   // right click means settings; the care menu has no place here
      if (!dom.panelEl.classList.contains("hidden")) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
        return;
      }
      if (!state.pets.length) {
        return;
      }
      togglePanel();
    });
    document.addEventListener("pointerdown", (event) => {
      if (careMenuEl && !careMenuEl.contains(event.target) && event.target !== dom.petEl) {
        hideCareMenu();
      }
      if (!dragging && !dom.panelEl.classList.contains("hidden") && !isInteractiveTarget(event.target)) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
      }
    });
    window.addEventListener("blur", () => {
      if (!dragging) {
        if (panelOpen() && hasActivePet()) {
          setPanelVisible(false);
          pointerInsideInteractiveArea = false;
          setMousePassthrough(hasActivePet());
          return;
        }
        pointerInsideInteractiveArea = false;
        setMousePassthrough(false);
      }
    });
    document.addEventListener("mousemove", updateMousePassthrough);
    document.addEventListener("mouseleave", () => {
      if (!dragging && dom.panelEl.classList.contains("hidden")) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
      }
    });

    dom.panelEl.addEventListener("pointerenter", () => setMousePassthrough(false));
    dom.emptyStateEl.addEventListener("pointerenter", () => setMousePassthrough(false));
    dom.panelEl.addEventListener("pointerleave", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(false);
      }
    });
    dom.emptyStateEl.addEventListener("pointerleave", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(false);
      }
    });
    dom.closePanelButton?.addEventListener("click", () => {
      setPanelVisible(false);
      pointerInsideInteractiveArea = false;
      setMousePassthrough(hasActivePet());
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dom.panelEl.classList.contains("hidden")) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
      }
    });

    dom.petSelect.addEventListener("change", () => {
      cancelCareAction();
      pickPet(dom.petSelect.value);
    });
    dom.stateSelect.addEventListener("change", () => {
      cancelCareAction();
      animation.setState(dom.stateSelect.value);
    });
    dom.scaleRange.addEventListener("input", () => {
      document.documentElement.style.setProperty("--scale", dom.scaleRange.value);
      onLayoutChange().catch?.(() => {});
    });
    dom.topToggle.addEventListener("change", () => {
      petDesktop?.setAlwaysOnTop(dom.topToggle.checked);
    });
  }

  /// Keep the current state on screen for a while, for the pose inspector.
  ///
  /// Without this the inspector's order is overwritten by the next wander tick, often within a
  /// second: the state does change, and the observer sees nothing. Pushing wanderUntil forward is
  /// enough - the loop treats the pet as busy and leaves it alone until the hold expires.
  function holdState(durationMs = 6000) {
    wanderDirection = 0;
    edgePaused = false;
    activeCareState = "";
    careUntil = 0;
    wanderUntil = performance.now() + Math.max(500, durationMs);
  }

  return {
    bind,
    hasActivePet,
    holdState,
    playCareAction,
    scheduleWander,
    refreshLifeEngine,
    setMousePassthrough,
    setPanelVisible,
    stopWander,
    wanderLoop
  };
}
