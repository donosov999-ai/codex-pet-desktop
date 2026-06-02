#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { validatePetResources, writeQaReport } = require("./qa-petpack-assets");

const root = path.resolve(__dirname, "..");
const petsRoot = path.join(root, "resources", "pets");
const outDir = path.join(root, "release", "petpacks");
const previewsDir = path.join(outDir, "previews");
const stagingRoot = path.join(root, "release", ".petpack-staging");
const SPRITE = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208
};
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listPets() {
  return fs
    .readdirSync(petsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function writePetpackManifest(stagingDir, manifest) {
  const petpackPath = path.join(stagingDir, "petpack.json");
  fs.writeFileSync(
    petpackPath,
    `${JSON.stringify(
      {
        format: "codex-petpack",
        formatVersion: 1,
        id: manifest.id,
        displayName: manifest.displayName || manifest.name || manifest.id,
        version: manifest.version || "1.0.0",
        author: manifest.author,
        license: manifest.license,
        minAppVersion: manifest.minAppVersion,
        tags: manifest.tags || [],
        changelog: manifest.changelog || []
      },
      null,
      2
    )}\n`
  );
  return petpackPath;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32LE(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function assertZip32Size(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} is too large for a standard petpack zip`);
  }
}

function createPetpackZip(outPath, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = (1 << 5) | 1;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = fs.readFileSync(entry.path);
    const checksum = crc32(data);
    assertZip32Size(name.length, `Zip entry name ${entry.name}`);
    assertZip32Size(data.length, `Zip entry ${entry.name}`);
    assertZip32Size(offset, `Zip entry offset ${entry.name}`);

    const localHeader = Buffer.concat([
      writeUInt32LE(0x04034b50),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(dosTime),
      writeUInt16LE(dosDate),
      writeUInt32LE(checksum),
      writeUInt32LE(data.length),
      writeUInt32LE(data.length),
      writeUInt16LE(name.length),
      writeUInt16LE(0),
      name
    ]);
    localParts.push(localHeader, data);

    centralParts.push(
      Buffer.concat([
        writeUInt32LE(0x02014b50),
        writeUInt16LE(20),
        writeUInt16LE(20),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt16LE(dosTime),
        writeUInt16LE(dosDate),
        writeUInt32LE(checksum),
        writeUInt32LE(data.length),
        writeUInt32LE(data.length),
        writeUInt16LE(name.length),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt32LE(0),
        writeUInt32LE(offset),
        name
      ])
    );

    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  assertZip32Size(centralDirectory.length, "Zip central directory");
  assertZip32Size(offset, "Zip central directory offset");
  const end = Buffer.concat([
    writeUInt32LE(0x06054b50),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(entries.length),
    writeUInt16LE(entries.length),
    writeUInt32LE(centralDirectory.length),
    writeUInt32LE(offset),
    writeUInt16LE(0)
  ]);

  fs.writeFileSync(outPath, Buffer.concat([...localParts, centralDirectory, end]));
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let index = 0; index < 8; index += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

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

fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(previewsDir, { recursive: true });
fs.mkdirSync(stagingRoot, { recursive: true });

const qaReport = validatePetResources(petsRoot);
if (!qaReport.ok) {
  writeQaReport(qaReport, path.join(outDir, "qa.json"));
  console.error(JSON.stringify(qaReport, null, 2));
  process.exit(1);
}

const index = [];

for (const id of listPets()) {
  const petDir = path.join(petsRoot, id);
  const manifest = readJson(path.join(petDir, "pet.json"));
  const spritesheet = manifest.spritesheetPath || "spritesheet.webp";
  const stagingDir = path.join(stagingRoot, id);
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.copyFileSync(path.join(petDir, "pet.json"), path.join(stagingDir, "pet.json"));
  fs.copyFileSync(path.join(petDir, spritesheet), path.join(stagingDir, spritesheet));
  writePetpackManifest(stagingDir, manifest);
  const fileName = `${id}-${manifest.version || "1.0.0"}.petpack`;
  const outPath = path.join(outDir, fileName);

  if (!fs.existsSync(path.join(petDir, spritesheet))) {
    throw new Error(`Missing spritesheet for ${id}: ${spritesheet}`);
  }

  fs.rmSync(outPath, { force: true });
  createPetpackZip(outPath, [
    { name: "petpack.json", path: path.join(stagingDir, "petpack.json") },
    { name: "pet.json", path: path.join(stagingDir, "pet.json") },
    { name: spritesheet, path: path.join(stagingDir, spritesheet) }
  ]);

  const previewAtlas = `previews/${id}-${manifest.version || "1.0.0"}-atlas.webp`;
  fs.copyFileSync(path.join(petDir, spritesheet), path.join(outDir, previewAtlas));
  const qa = qaReport.pets.find((pet) => pet.id === id) || {};
  qa.previewAtlas = previewAtlas;

  index.push({
    id: manifest.id || id,
    displayName: manifest.displayName || manifest.name || id,
    description: manifest.description || "",
    version: manifest.version || "1.0.0",
    author: manifest.author || "",
    license: manifest.license || "",
    minAppVersion: manifest.minAppVersion || "0.2.0",
    tags: manifest.tags || [],
    changelog: manifest.changelog || [],
    fileName,
    sizeBytes: fs.statSync(outPath).size,
    sha256: sha256(outPath),
    previewAtlas,
    spritesheet,
    sprite: SPRITE,
    qa: {
      ok: qa.ok === true,
      width: qa.width || 0,
      height: qa.height || 0,
      expectedWidth: qaReport.expected.width,
      expectedHeight: qaReport.expected.height,
      previewAtlas
    }
  });
}

fs.writeFileSync(path.join(outDir, "petpacks.json"), `${JSON.stringify(index, null, 2)}\n`);
writeQaReport(qaReport, path.join(outDir, "qa.json"));
fs.writeFileSync(path.join(outDir, "visual-qa.html"), renderVisualQaPage(index));
fs.rmSync(stagingRoot, { recursive: true, force: true });
