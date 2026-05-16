export function getDomRefs() {
  return {
    petEl: document.querySelector("#pet"),
    emptyStateEl: document.querySelector("#emptyState"),
    panelEl: document.querySelector("#panel"),
    panelBackdropEl: document.querySelector("#panelBackdrop"),
    petSelect: document.querySelector("#petSelect"),
    stateSelect: document.querySelector("#stateSelect"),
    scaleRange: document.querySelector("#scaleRange"),
    wanderToggle: document.querySelector("#wanderToggle"),
    topToggle: document.querySelector("#topToggle"),
    importButton: document.querySelector("#importButton"),
    importEmptyButton: document.querySelector("#importEmptyButton"),
    petpackInput: document.querySelector("#petpackInput"),
    importPreviewEl: document.querySelector("#importPreview"),
    importPreviewTextEl: document.querySelector("#importPreviewText"),
    confirmImportButton: document.querySelector("#confirmImportButton"),
    cancelImportButton: document.querySelector("#cancelImportButton"),
    petManagerEl: document.querySelector("#petManager"),
    petStatusEl: document.querySelector("#petStatus"),
    checkUpdateButton: document.querySelector("#checkUpdateButton"),
    checkPetpackUpdatesButton: document.querySelector("#checkPetpackUpdatesButton"),
    openDownloadsButton: document.querySelector("#openDownloadsButton"),
    updateStatusEl: document.querySelector("#updateStatus"),
    quitButton: document.querySelector("#quitButton")
  };
}

export function setElementText(element, message) {
  if (element) {
    element.textContent = message || "";
  }
}
