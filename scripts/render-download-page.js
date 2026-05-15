#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function petCard(pet) {
  const displayName = escapeHtml(pet.displayName || pet.id);
  const description = escapeHtml(pet.description || "宠物资源包。");
  const version = escapeHtml(pet.version || "1.0.0");
  const fileName = escapeHtml(pet.fileName);
  return `          <article class="download">
            <h3>${displayName}</h3>
            <p>${description}</p>
            <p class="meta">v${version}</p>
            <a href="./petpacks/${fileName}">下载 ${displayName}</a>
          </article>`;
}

function renderDownloadPage(petpacks) {
  const cards = [...petpacks]
    .sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id), "zh-CN"))
    .map(petCard)
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>宠物·永生计划</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        color: #17202a;
        background: #f4f7fb;
      }
      body {
        margin: 0;
      }
      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 48px 20px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
        letter-spacing: 0;
      }
      h2 {
        margin: 0 0 10px;
        font-size: 21px;
        letter-spacing: 0;
      }
      p {
        color: #526171;
        line-height: 1.7;
      }
      .downloads {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .section {
        margin-top: 34px;
      }
      .download {
        padding: 20px;
        border: 1px solid #dce3ec;
        border-radius: 8px;
        background: #ffffff;
      }
      .download h3 {
        margin: 0 0 8px;
        font-size: 18px;
        letter-spacing: 0;
      }
      .download a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        margin-top: 10px;
        margin-right: 8px;
        padding: 0 14px;
        color: #ffffff;
        background: #1f7a55;
        border-radius: 6px;
        text-decoration: none;
      }
      .meta {
        margin: 0;
        color: #6d7b8a;
        font-size: 13px;
      }
      code {
        padding: 2px 5px;
        border-radius: 4px;
        background: #e8eef6;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color: #eef3f8;
          background: #12161c;
        }
        p {
          color: #aeb9c6;
        }
        .download {
          border-color: #2b3542;
          background: #1a2028;
        }
        .meta {
          color: #8492a3;
        }
        code {
          background: #252d38;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>宠物·永生计划</h1>
      <p>先安装主程序，再下载宠物资源包。主程序更新和宠物资源更新彼此独立。</p>

      <section class="section" aria-label="App downloads">
        <h2>主程序</h2>
        <div class="downloads">
          <article class="download">
            <h3>Windows</h3>
            <p>适合 Windows x64。</p>
            <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-windows-x64.exe">下载 Windows 版</a>
          </article>
          <article class="download">
            <h3>macOS</h3>
            <p>根据 Mac 芯片选择 Apple Silicon 或 Intel。</p>
            <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-macos-arm64.dmg">Apple Silicon</a>
            <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-macos-x64.dmg">Intel</a>
          </article>
        </div>
      </section>

      <section class="section" aria-label="Petpacks">
        <h2>宠物资源包</h2>
        <p>下载 <code>.petpack</code> 后，在主程序里点击 Import Petpack 导入。</p>
        <div class="downloads">
${cards}
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function main() {
  const indexPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(ROOT, "release", "petpacks", "petpacks.json");
  const outPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, "docs", "index.html");
  const petpacks = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderDownloadPage(petpacks));
  console.log(JSON.stringify({ ok: true, outPath, petCount: petpacks.length }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  renderDownloadPage
};
