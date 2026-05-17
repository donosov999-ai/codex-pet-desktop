export function createInteractions({ animation, dom, petDesktop, state }) {
  let dragging = false;
  let pointerInsideInteractiveArea = false;
  let dragLastScreenX = 0;
  let dragLastScreenY = 0;
  let wanderTimer = 0;
  let wanderDirection = 0;
  let wanderUntil = 0;

  function hasActivePet() {
    return Boolean(state.activePet && state.pets.some((pet) => pet.id === state.activePet.id));
  }

  function setMousePassthrough(ignored) {
    petDesktop?.setIgnoreMouseEvents(ignored);
  }

  function isInteractiveTarget(target) {
    return Boolean(target?.closest?.("#pet, #emptyState, #panel, #panelBackdrop"));
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
    window.clearTimeout(wanderTimer);
  }

  function scheduleWander() {
    window.clearTimeout(wanderTimer);
    if (!hasActivePet()) {
      wanderDirection = 0;
      wanderUntil = 0;
      return;
    }
    wanderTimer = window.setTimeout(() => {
      if (
        !hasActivePet() ||
        !dom.wanderToggle.checked ||
        dragging ||
        dom.panelEl.classList.contains("hidden") === false
      ) {
        scheduleWander();
        return;
      }
      const directions = [-1, 1, 0];
      wanderDirection = directions[Math.floor(Math.random() * directions.length)];
      wanderUntil = performance.now() + (wanderDirection === 0 ? 1800 : 3200);
      if (wanderDirection < 0) {
        animation.setState("running-left");
      } else if (wanderDirection > 0) {
        animation.setState("running-right");
      } else {
        animation.setState("waiting");
      }
    }, 3500 + Math.random() * 4500);
  }

  function wanderLoop(now) {
    if (
      hasActivePet() &&
      wanderDirection !== 0 &&
      now < wanderUntil &&
      dom.wanderToggle.checked &&
      !dragging
    ) {
      petDesktop?.moveBy(wanderDirection * 2, 0);
    }
    if (wanderUntil && now >= wanderUntil) {
      wanderDirection = 0;
      wanderUntil = 0;
      animation.setState("idle");
      scheduleWander();
    }
    requestAnimationFrame(wanderLoop);
  }

  function setPanelVisible(show) {
    dom.panelEl.classList.toggle("hidden", !show);
    dom.panelBackdropEl.classList.toggle("hidden", !show);
    setMousePassthrough(false);
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
      dragging = true;
      pointerInsideInteractiveArea = true;
      dragLastScreenX = event.screenX;
      dragLastScreenY = event.screenY;
      setMousePassthrough(false);
      dom.petEl.setPointerCapture?.(event.pointerId);
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
        petDesktop?.moveBy(deltaX, deltaY);
      }
    });

    function finishDrag(event) {
      if (!dragging) {
        return;
      }
      dragging = false;
      dom.petEl.releasePointerCapture?.(event.pointerId);
      scheduleWander();
    }

    dom.petEl.addEventListener("pointerup", finishDrag);
    dom.petEl.addEventListener("pointercancel", finishDrag);
    dom.petEl.addEventListener("lostpointercapture", () => {
      if (dragging) {
        dragging = false;
        scheduleWander();
      }
    });
    dom.petEl.addEventListener("click", () => {
      if (!dragging && dom.panelEl.classList.contains("hidden")) {
        animation.setState("waving");
      }
    });
    dom.petEl.addEventListener("dblclick", () => {
      animation.setState("jumping");
    });

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!state.pets.length) {
        return;
      }
      if (dom.panelEl.contains(event.target)) {
        return;
      }
      togglePanel();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!dragging && !dom.panelEl.classList.contains("hidden") && !isInteractiveTarget(event.target)) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(true);
      }
    });
    window.addEventListener("blur", () => {
      if (!dragging) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(true);
      }
    });
    document.addEventListener("mousemove", updateMousePassthrough);
    document.addEventListener("mouseleave", () => {
      if (!dragging && dom.panelEl.classList.contains("hidden")) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(true);
      }
    });

    dom.panelEl.addEventListener("pointerenter", () => setMousePassthrough(false));
    dom.emptyStateEl.addEventListener("pointerenter", () => setMousePassthrough(false));
    dom.panelEl.addEventListener("pointerleave", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(true);
      }
    });
    dom.emptyStateEl.addEventListener("pointerleave", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(true);
      }
    });

    dom.petSelect.addEventListener("change", () => pickPet(dom.petSelect.value));
    dom.stateSelect.addEventListener("change", () => animation.setState(dom.stateSelect.value));
    dom.scaleRange.addEventListener("input", () => {
      document.documentElement.style.setProperty("--scale", dom.scaleRange.value);
    });
    dom.topToggle.addEventListener("change", () => {
      petDesktop?.setAlwaysOnTop(dom.topToggle.checked);
    });
  }

  return {
    bind,
    hasActivePet,
    scheduleWander,
    setMousePassthrough,
    setPanelVisible,
    stopWander,
    wanderLoop
  };
}
