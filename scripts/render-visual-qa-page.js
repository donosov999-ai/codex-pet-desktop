const STATES = [
  ["idle", 0, 6],
  ["running-right", 1, 8],
  ["running-left", 2, 8],
  ["waving", 3, 4],
  ["jumping", 4, 5],
  ["failed", 5, 8],
  ["waiting", 6, 6],
  ["running", 7, 6],
  ["review", 8, 6]
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderVisualQaPage(petpacks) {
  const cards = petpacks
    .map((pet) => {
      const displayName = escapeHtml(pet.displayName || pet.id);
      const id = escapeHtml(pet.id);
      const version = escapeHtml(pet.version);
      const license = escapeHtml(pet.license || "未标许可");
      const author = escapeHtml(pet.author || "未知作者");
      const previewAtlas = escapeHtml(pet.previewAtlas);
      const dimensions = `${pet.qa.width}x${pet.qa.height}`;
      const rows = STATES.map(([state, row, frames]) => {
        const frameCells = Array.from({ length: frames }, (_, col) => {
          const x = -col * 96;
          const y = -row * 104;
          return `<span class="frame" style="background-image: url('./${previewAtlas}'); background-position: ${x}px ${y}px" aria-label="${escapeHtml(
            state
          )} frame ${col + 1}"></span>`;
        }).join("");
        return `            <div class="state-row" data-state="${escapeHtml(state)}">
              <div class="state-name">${escapeHtml(state)}</div>
              <div class="frames">${frameCells}</div>
            </div>`;
      }).join("\n");
      return `        <article class="pet" id="${id}">
          <header class="pet-header">
            <div class="preview" style="background-image: url('./${previewAtlas}')"></div>
            <div>
              <h2>${displayName}</h2>
              <p class="meta">${id} · v${version} · 作者 ${author} · ${license} · ${escapeHtml(dimensions)} · ${escapeHtml(pet.spritesheet)}</p>
              <a href="./${previewAtlas}">打开完整 atlas</a>
            </div>
          </header>
          <div class="states" aria-label="${displayName} 动作帧">
${rows}
          </div>
        </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>宠物资源视觉 QA</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17202a;
        background: #f6f8fb;
      }
      body {
        margin: 0;
      }
      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 30px;
        letter-spacing: 0;
      }
      .summary {
        margin: 0 0 24px;
        color: #526171;
        line-height: 1.7;
      }
      .grid {
        display: grid;
        gap: 18px;
      }
      .pet {
        padding: 16px;
        border: 1px solid #dce3ec;
        border-radius: 8px;
        background: #ffffff;
      }
      .pet-header {
        display: grid;
        grid-template-columns: 96px 1fr;
        gap: 14px;
        align-items: center;
      }
      .preview {
        width: 96px;
        height: 104px;
        border-radius: 6px;
        background-repeat: no-repeat;
        background-position: 0 0;
        background-size: 800% 900%;
        image-rendering: auto;
      }
      .states {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }
      .state-row {
        display: grid;
        grid-template-columns: 112px minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }
      .state-name {
        padding-top: 4px;
        color: #627184;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
      }
      .frames {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .frame {
        width: 96px;
        height: 104px;
        border: 1px solid #edf1f5;
        border-radius: 5px;
        background-repeat: no-repeat;
        background-size: 768px 936px;
      }
      h2 {
        margin: 0 0 6px;
        font-size: 18px;
        letter-spacing: 0;
      }
      .meta {
        margin: 0 0 10px;
        color: #627184;
        font-size: 13px;
        line-height: 1.5;
      }
      a {
        color: #156b4a;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color: #eef3f8;
          background: #12161c;
        }
        .summary,
        .meta {
          color: #aeb9c6;
        }
        .pet {
          border-color: #2b3542;
          background: #1a2028;
        }
        .state-name {
          color: #aeb9c6;
        }
        .frame {
          border-color: #2b3542;
        }
        a {
          color: #7ad0a8;
        }
      }
      @media (max-width: 620px) {
        .state-row {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>宠物资源视觉 QA</h1>
      <p class="summary">每个宠物按状态展示实际帧裁切，用于发布前检查动作比例、画风和错帧。</p>
      <section class="grid" aria-label="Pet visual QA">
${cards}
      </section>
    </main>
  </body>
</html>
`;
}

module.exports = {
  escapeHtml,
  renderVisualQaPage
};
