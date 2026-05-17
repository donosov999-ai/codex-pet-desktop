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
if (!friendlyPetpackError(new Error("Pet id mismatch: a b")).includes("id 不一致")) {
  errors.push("id mismatch error not friendly");
}

const upgradePreview = {
  id: "mi-fen",
  displayName: "米粉",
  version: "1.0.2",
  existingManagedVersion: "1.0.1",
  existingVisibleVersion: "1.0.1",
  willReplaceManaged: true,
  versionRelation: "upgrade"
};
if (!importPreviewMessage(upgradePreview).includes("1.0.1") || !importConfirmLabel(upgradePreview).includes("覆盖")) {
  errors.push("upgrade preview text invalid");
}

const incompatiblePreview = {
  id: "future",
  displayName: "未来宠物",
  version: "2.0.0",
  compatible: false,
  compatibilityMessage: "需要主程序 v9.0.0 或更高版本"
};
if (!importPreviewMessage(incompatiblePreview).includes("v9.0.0") || importConfirmLabel(incompatiblePreview) !== "暂不可导入") {
  errors.push("incompatible preview text invalid");
}

const summary = summarizePetpackUpdates(
  [{ id: "mi-fen", displayName: "米粉", version: "1.0.1" }],
  [
    { id: "mi-fen", displayName: "米粉", version: "1.0.2" },
    { id: "mi-jiu", displayName: "米酒", version: "1.0.0" }
  ]
);
if (summary.kind !== "upgrade" || !summary.message.includes("米粉") || !summary.message.includes("v1.0.2")) {
  errors.push("petpack update summary invalid");
}

const incompatibleSummary = summarizePetpackUpdates(
  [{ id: "mi-fen", displayName: "米粉", version: "1.0.1" }],
  [{ id: "mi-fen", displayName: "米粉", version: "1.0.3", minAppVersion: "9.0.0" }],
  "0.2.5"
);
if (
  incompatibleSummary.kind !== "app-upgrade-required" ||
  !incompatibleSummary.message.includes("需要先升级主程序") ||
  incompatibleSummary.message.includes("直接更新")
) {
  errors.push("incompatible petpack update summary invalid");
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary }, null, 2));
