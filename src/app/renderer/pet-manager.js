import { resolveSpritesheetSource } from "./bridge.js";

function versionLabel(pet) {
  return pet?.version ? pet.version : "unversioned";
}

export function createPetManager({
  animation,
  dom,
  petDesktop,
  scheduleWander,
  setPetStatus,
  state,
  stopWander,
  tauriConvertFileSrc
}) {
  function pickPet(id) {
    state.activePet = state.pets.find((pet) => pet.id === id) || state.pets[0];
    if (!state.activePet) {
      stopWander();
      dom.petEl.style.backgroundImage = "";
      dom.petEl.setAttribute("aria-label", "No pet found");
      dom.petEl.textContent = "";
      dom.petEl.classList.add("empty");
      dom.emptyStateEl.classList.remove("hidden");
      return;
    }
    dom.petEl.classList.remove("empty");
    dom.emptyStateEl.classList.add("hidden");
    const source = resolveSpritesheetSource(state.activePet, tauriConvertFileSrc);
    dom.petEl.style.backgroundImage = source ? `url("${source}")` : "";
    dom.petEl.textContent = "";
    dom.petEl.setAttribute("aria-label", state.activePet.displayName);
    dom.petSelect.value = state.activePet.id;
    animation.setState("idle");
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
      empty.textContent = "No pets installed.";
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
        meta.textContent = `${pet.id} · ${pet.sourceKind || "external"}`;

        const actions = document.createElement("div");
        actions.className = "pet-manager-actions";
        const reveal = document.createElement("button");
        reveal.type = "button";
        reveal.textContent = "Reveal";
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
      setPetStatus(`Skipped ${result.errors.length} invalid pet folder(s).`);
    }
  }

  async function uninstallPet(pet) {
    if (!pet?.canUninstall) {
      setPetStatus("Only imported app-data petpacks can be uninstalled here.");
      return;
    }
    const result = await petDesktop.uninstallPet(pet.id);
    setPetStatus(`已卸载 ${pet.displayName}`);
    refreshPetList(result, state.activePet?.id === pet.id ? undefined : state.activePet?.id);
  }

  return {
    pickPet,
    refreshPetList
  };
}
