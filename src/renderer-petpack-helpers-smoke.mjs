import {
  friendlyPetpackError,
  importConfirmLabel,
  importPreviewMessage
} from "./app/renderer/petpack.js";
import { summarizePetpackUpdates } from "./app/renderer/version.js";

const errors = [];

if (!friendlyPetpackError(new Error("Missing required petpack file: pet.json")).includes("pet.json")) {
  errors.push("missing pet.json error not friendly");
}
if (!friendlyPetpackError(new Error("Pet id mismatch: a b")).includes("IDs in petpack.json and pet.json do not match")) {
  errors.push("id mismatch error not friendly");
}

const upgradePreview = {
  id: "mi-fen",
  displayName: "Mi Fen",
  version: "1.0.2",
  existingManagedVersion: "1.0.1",
  existingVisibleVersion: "1.0.1",
  willReplaceManaged: true,
  versionRelation: "upgrade"
};
if (!importPreviewMessage(upgradePreview).includes("1.0.1") || !importConfirmLabel(upgradePreview).includes("replacement")) {
  errors.push("upgrade preview text invalid");
}

const incompatiblePreview = {
  id: "future",
  displayName: "Future Pet",
  version: "2.0.0",
  compatible: false,
  compatibilityMessage: "Requires app v9.0.0 or newer"
};
if (!importPreviewMessage(incompatiblePreview).includes("v9.0.0") || importConfirmLabel(incompatiblePreview) !== "Cannot import") {
  errors.push("incompatible preview text invalid");
}

const summary = summarizePetpackUpdates(
  [{ id: "mi-fen", displayName: "Mi Fen", version: "1.0.1" }],
  [
    { id: "mi-fen", displayName: "Mi Fen", version: "1.0.2" },
    { id: "mi-jiu", displayName: "Mi Jiu", version: "1.0.0" }
  ]
);
if (summary.kind !== "upgrade" || !summary.message.includes("Mi Fen") || !summary.message.includes("v1.0.2")) {
  errors.push("petpack update summary invalid");
}

const incompatibleSummary = summarizePetpackUpdates(
  [{ id: "mi-fen", displayName: "Mi Fen", version: "1.0.1" }],
  [{ id: "mi-fen", displayName: "Mi Fen", version: "1.0.3", minAppVersion: "9.0.0" }],
  "0.2.5"
);
if (
  incompatibleSummary.kind !== "app-upgrade-required" ||
  !incompatibleSummary.message.includes("first update the app") ||
  incompatibleSummary.message.includes("Update it directly")
) {
  errors.push("incompatible petpack update summary invalid");
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary }, null, 2));
