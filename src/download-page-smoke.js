const { renderDownloadPage } = require("../scripts/render-download-page");

const html = renderDownloadPage([
  {
    id: "mi-fen",
    displayName: "Mi Fen",
    description: "white cat",
    version: "1.0.2",
    author: "Chen",
    license: "CC-BY-4.0",
    minAppVersion: "0.2.0",
    tags: ["cat", "white"],
    changelog: ["Fixed the paw-licking animation"],
    fileName: "mi-fen-1.0.2.petpack",
    previewAtlas: "previews/mi-fen-1.0.2-atlas.webp"
  },
  {
    id: "tigris-whippet",
    displayName: "Hong Tang",
    description: "brindle whippet",
    version: "1.0.1",
    author: "Chen",
    license: "CC-BY-4.0",
    minAppVersion: "0.2.0",
    tags: ["dog"],
    changelog: ["Added a lying-down idle animation"],
    fileName: "tigris-whippet-1.0.1.petpack",
    previewAtlas: "previews/tigris-whippet-1.0.1-atlas.webp"
  }
]);

const required = [
  "Pet Forever Project",
  "Keep familiar pets on your desktop",
  "biruzik-desktop-windows-x64.exe",
  "mi-fen-1.0.2.petpack",
  "./petpacks/previews/mi-fen-1.0.2-atlas.webp",
  "./petpacks/visual-qa.html#mi-fen",
  "idle frame preview",
  "by Chen",
  "CC-BY-4.0",
  "Fixed the paw-licking animation",
  "cat",
  "tigris-whippet-1.0.1.petpack",
  "v1.0.2"
];
const missing = required.filter((text) => !html.includes(text));
if (missing.length > 0) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, length: html.length }, null, 2));
