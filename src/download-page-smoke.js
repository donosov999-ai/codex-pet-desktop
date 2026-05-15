const { renderDownloadPage } = require("../scripts/render-download-page");

const html = renderDownloadPage([
  {
    id: "mi-fen",
    displayName: "米粉",
    description: "全白猫咪",
    version: "1.0.2",
    fileName: "mi-fen-1.0.2.petpack"
  },
  {
    id: "tigris-whippet",
    displayName: "红糖",
    description: "虎斑色惠比特",
    version: "1.0.1",
    fileName: "tigris-whippet-1.0.1.petpack"
  }
]);

const required = [
  "宠物·永生计划",
  "yongsheng-plan-windows-x64.exe",
  "mi-fen-1.0.2.petpack",
  "tigris-whippet-1.0.1.petpack",
  "v1.0.2"
];
const missing = required.filter((text) => !html.includes(text));
if (missing.length > 0) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, length: html.length }, null, 2));
