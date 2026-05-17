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
    openStoreEmptyButton: document.querySelector("#openStoreEmptyButton"),
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
    openStoreButton: document.querySelector("#openStoreButton"),
    updateStatusEl: document.querySelector("#updateStatus"),
    petStoreEl: document.querySelector("#petStore"),
    storeFilter: document.querySelector("#storeFilter"),
    refreshStoreButton: document.querySelector("#refreshStoreButton"),
    petStoreStatusEl: document.querySelector("#petStoreStatus"),
    petStoreListEl: document.querySelector("#petStoreList"),
    quitButton: document.querySelector("#quitButton")
  };
}

export function setElementText(element, message) {
  if (element) {
    element.textContent = message || "";
  }
}
