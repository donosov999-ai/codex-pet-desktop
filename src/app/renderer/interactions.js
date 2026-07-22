import { activeBehavior, createLifeEngine } from "./life-engine.js";

export function createInteractions({ animation, dom, onLayoutChange = () => {}, petDesktop, state }) {
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
    const nextIgnored = isWindowsRuntime() ? false : Boolean(ignored);
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
      Promise.resolve(petDesktop?.moveBy(wanderDirection, 0))
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
      if (!dragging && dom.panelEl.classList.contains("hidden")) {
        cancelCareAction();
        const behavior = refreshLifeEngine();
        const plan = lifeEngine.planInteraction("click");
        animation.setState(plan?.state || behavior.clickState, {
          onceReturn: plan?.onceReturn || behavior.natural.clickReturnState
        });
      }
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

  return {
    bind,
    hasActivePet,
    playCareAction,
    scheduleWander,
    refreshLifeEngine,
    setMousePassthrough,
    setPanelVisible,
    stopWander,
    wanderLoop
  };
}
