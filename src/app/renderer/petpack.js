export async function readFileAsBase64(file) {
  return arrayBufferToBase64(await file.arrayBuffer());
}

export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function friendlyPetpackError(error) {
  const message = String(error?.message || error || "");
  if (/invalid zip|not a zip|Invalid archive|zip/i.test(message)) {
    return "This is not a valid .petpack file.";
  }
  if (message.includes("pet.json")) {
    return "The pack is missing pet.json, or pet.json is invalid.";
  }
  if (message.includes("spritesheet.webp") || message.includes("spritesheet")) {
    return "The pack is missing the spritesheet.webp atlas.";
  }
  if (message.includes("Unsupported petpack format version")) {
    return "This pet pack version is not supported by the current app.";
  }
  if (message.includes("Unsupported petpack format")) {
    return "This pet pack format is not supported.";
  }
  if (message.includes("Pet id mismatch")) {
    return "The pet IDs in petpack.json and pet.json do not match.";
  }
  if (message.includes("Invalid pet id")) {
    return "Pet IDs may contain only letters, numbers, hyphens, and underscores.";
  }
  if (message.includes("requires app version") || message.includes("minAppVersion")) {
    return "This pack requires a newer app version.";
  }
  return message || "Failed to import the pet pack.";
}

export function importPreviewMessage(preview) {
  const name = preview.displayName || preview.id;
  const version = preview.version || "unknown";
  const existing = preview.existingManagedVersion || preview.existingVisibleVersion || "";
  const source = preview.existingVisibleSourceKind || "";

  if (preview.compatible === false) {
    return preview.compatibilityMessage || "This pack requires a newer app version.";
  }
  if (preview.versionRelation === "upgrade") {
    return `Replace ${name}: v${existing || "unknown"} -> v${version}.${preview.changelog?.[0] ? ` Changes: ${preview.changelog[0]}.` : ""}`;
  }
  if (preview.versionRelation === "same") {
    return `${name} v${version} is already installed. Continuing will replace its files.`;
  }
  if (preview.versionRelation === "downgrade") {
    return `The installed version is v${existing || "unknown"}; the selected ${name} is v${version}. Continuing will downgrade it.`;
  }
  if (preview.willReplaceManaged) {
    return `Replace ${name} with v${version}.`;
  }
  if (source && source !== "managed") {
    return `A pet with the same ID was found in ${source}. Importing ${name} v${version} into app data may not take priority.`;
  }
  return `Import ${name} v${version}.`;
}

export function importConfirmLabel(preview) {
  if (!preview) {
    return "Import";
  }
  if (preview.versionRelation === "downgrade") {
    return "Confirm downgrade";
  }
  if (preview.compatible === false) {
    return "Cannot import";
  }
  if (preview.willReplaceManaged || preview.existingVisibleVersion) {
    return "Confirm replacement";
  }
  return "Confirm import";
}
