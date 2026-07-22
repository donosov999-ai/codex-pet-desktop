import { resolveCareSpritesheetSource, resolveSpritesheetSource } from "./bridge.js";

function versionLabel(pet) {
  return pet?.version ? pet.version : "unversioned";
}

function sourceLabel(sourceKind) {
  return (
    {
      managed: "Imported in app",
      external: "External directory",
      bundled: "Bundled resource",
      codex: "Codex directory"
    }[sourceKind] || "External directory"
  );
}

export function createPetManager({
  animation,
  dom,
  petDesktop,
  playCareAction,
  scheduleWander,
  setPetStatus,
  state,
  stopWander,
  syncWindowLayout = () => {},
  tauriConvertFileSrc
}) {
  function renderCareActions() {
    const careStates = animation.getCareStates?.() || [];
    dom.careControlsEl?.classList.toggle("hidden", careStates.length === 0);
    if (!dom.careActionsEl) {
      return;
    }
    dom.careActionsEl.replaceChildren(
      ...careStates.map((careState) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.careState = careState.id;
        button.textContent = careState.label;
        button.addEventListener("click", () => playCareAction?.(careState.id, careState.durationMs));
        return button;
      })
    );
  }

  function pickPet(id) {
    state.activePet = state.pets.find((pet) => pet.id === id) || state.pets[0];
    if (!state.activePet) {
      stopWander();
      dom.petEl.style.backgroundImage = "";
      dom.petEl.setAttribute("aria-label", "No pet installed");
      dom.petEl.textContent = "";
      dom.petEl.classList.add("empty");
      animation.configurePet(null);
      renderCareActions();
      const panelVisible = !dom.panelEl.classList.contains("hidden");
      dom.emptyStateEl.classList.toggle("hidden", panelVisible);
      document.documentElement.classList.toggle("panel-with-pet", false);
      syncWindowLayout({ centerIfEmpty: !panelVisible }).catch?.(() => {});
      return;
    }
    dom.petEl.classList.remove("empty");
    dom.emptyStateEl.classList.add("hidden");
    document.documentElement.classList.toggle("panel-with-pet", !dom.panelEl.classList.contains("hidden"));
    const source = resolveSpritesheetSource(state.activePet, tauriConvertFileSrc);
    const careSource = resolveCareSpritesheetSource(state.activePet, tauriConvertFileSrc);
    animation.configurePet(state.activePet, { standardSource: source, careSource });
    renderCareActions();
    dom.petEl.textContent = "";
    dom.petEl.setAttribute("aria-label", state.activePet.displayName);
    dom.petSelect.value = state.activePet.id;
    animation.setState("idle");
    syncWindowLayout().catch?.(() => {});
    scheduleWander();
  }

  function renderPetOptions() {
    dom.petSelect.replaceChildren(
      ...state.pets.map((pet) => {
        const option = document.createElement("option");
        option.value = pet.id;
        option.textContent = pet.displayName;
        return option;
      })
    );
  }

  function renderPetManager() {
    if (!dom.petManagerEl) {
      return;
    }
    if (!state.pets.length) {
      const empty = document.createElement("div");
      empty.className = "pet-manager-empty";
      empty.textContent = "No pets are installed yet.";
      dom.petManagerEl.replaceChildren(empty);
      return;
    }
    dom.petManagerEl.replaceChildren(
      ...state.pets.map((pet) => {
        const row = document.createElement("article");
        row.className = "pet-manager-row";

        const title = document.createElement("div");
        title.className = "pet-manager-title";
        const name = document.createElement("span");
        name.textContent = pet.displayName;
        const version = document.createElement("span");
        version.textContent = versionLabel(pet);
        title.append(name, version);

        const meta = document.createElement("div");
        meta.className = "pet-manager-meta";
        meta.textContent = `${pet.id} · ${sourceLabel(pet.sourceKind)}`;

        const actions = document.createElement("div");
        actions.className = "pet-manager-actions";
        const reveal = document.createElement("button");
        reveal.type = "button";
        reveal.textContent = "Open directory";
        reveal.addEventListener("click", () => {
          petDesktop?.revealPet?.(pet.id).catch((error) => setPetStatus(error.message));
        });
        const uninstall = document.createElement("button");
        uninstall.type = "button";
        uninstall.textContent = "Uninstall";
        uninstall.disabled = !pet.canUninstall;
        uninstall.addEventListener("click", () => {
          uninstallPet(pet).catch((error) => setPetStatus(error.message));
        });
        actions.append(reveal, uninstall);

        row.append(title, meta, actions);
        return row;
      })
    );
  }

  function refreshPetList(result, preferredPetId) {
    state.pets = result.pets || [];
    renderPetOptions();
    renderPetManager();
    pickPet(preferredPetId || state.pets[0]?.id);
    if (result.errors?.length) {
      setPetStatus(`Skipped ${result.errors.length} invalid pet directories.`);
    }
  }

  async function uninstallPet(pet) {
    if (!pet?.canUninstall) {
      setPetStatus("Only pet packs imported by this app can be uninstalled here.");
      return;
    }
    const result = await petDesktop.uninstallPet(pet.id);
    setPetStatus(`Uninstalled ${pet.displayName}`);
    refreshPetList(result, state.activePet?.id === pet.id ? undefined : state.activePet?.id);
  }

  return {
    pickPet,
    refreshPetList
  };
}
