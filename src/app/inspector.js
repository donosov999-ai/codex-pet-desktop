import { RU } from "./inspector.strings.ru.js";
import "./vendor/bugfix-app.js";

/// Pose inspector: shows every state row of every pack the way the app reads the atlas.
///
/// The checks below are the ones that actually caught defects in this deck, so they are worth
/// naming: a declared row with no ink (the pet vanishes in its default state), a row whose pose is
/// the idle pose (the pet slides across the desk without moving its legs), a frame whose silhouette
/// touches the cell edge (cut off sideways), body height jumping inside one row (the pet breathes
/// in and out), and an anchor sitting outside the silhouette (a hat in mid-air).

const STATE_ROWS = [
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
const CELL_W = 192;
const CELL_H = 208;
const ALPHA = 16;

const invoke = window.__TAURI__?.core?.invoke;
/// Orders go through an app command, not through the event bus.
///
/// Emitting an event straight from this page did nothing at all: an app command is always callable,
/// while emitting from a webview needs a permission this app never granted, and it fails without a
/// word. Rust relays the order to the window the pet lives in.
const order = (payload) => invoke?.("send_pet_order", { order: payload })?.catch?.(() => {});
const convertFileSrc = window.__TAURI__?.core?.convertFileSrc;

const el = {
  packs: document.getElementById("packs"),
  body: document.getElementById("body"),
  zoom: document.getElementById("zoom"),
  playPause: document.getElementById("playPause"),
  stepBack: document.getElementById("stepBack"),
  stepFwd: document.getElementById("stepFwd"),
  showAnchors: document.getElementById("showAnchors"),
  showCell: document.getElementById("showCell"),
  onlyProblems: document.getElementById("onlyProblems"),
  status: document.getElementById("status"),
  reportButton: document.getElementById("reportButton"),
  reportBox: document.getElementById("reportBox"),
  reportTitle: document.getElementById("reportTitle"),
  reportHint: document.getElementById("reportHint"),
  reportText: document.getElementById("reportText"),
  reportSend: document.getElementById("reportSend"),
  reportCancel: document.getElementById("reportCancel")
};

const state = { pets: [], reports: new Map(), current: "", playing: true, manualFrame: null };

function geometryOf(pet) {
  const atlas = pet?.atlas && typeof pet.atlas === "object" ? pet.atlas : {};
  return {
    cellWidth: Number(atlas.cellWidth) > 0 ? Number(atlas.cellWidth) : CELL_W,
    cellHeight: Number(atlas.cellHeight) > 0 ? Number(atlas.cellHeight) : CELL_H,
    columns: Number(atlas.columns) > 0 ? Number(atlas.columns) : 8
  };
}

function timingOf(pet, id, fallbackFrames) {
  const timing = pet?.stateTimings?.[id] || {};
  const frames = Number.isInteger(timing.frames) ? timing.frames : fallbackFrames;
  const base = { idle: 5, "running-right": 10, "running-left": 10, waving: 6, jumping: 8,
                 failed: 6, waiting: 5, running: 7, review: 6 }[id] || 6;
  const fps = Number(timing.fps) >= 2 && Number(timing.fps) <= 24 ? Number(timing.fps) : base;
  return { frames, fps, source: timing.source ?? null };
}

/// Load the atlas so that its pixels can be READ, not just drawn.
///
/// Drawing works either way; getImageData does not. In the app the atlas arrives over the asset://
/// protocol, a different origin from the page, so the canvas it is drawn into becomes tainted and
/// every pixel check throws SecurityError. Under the dev bench the sheet was served from the same
/// origin, so this never showed there — the first run inside the real app reported exactly one
/// finding on all 31 packs and drew nothing at all.
///
/// crossOrigin="anonymous" makes the request a CORS one, which the asset protocol answers, and the
/// canvas stays readable. It is set before src on purpose: after src the flag is ignored.
async function loadImage(url) {
  // Preferred route: pull the bytes and turn them into a blob of our own. A blob URL is
  // same-origin by definition, so the canvas it is drawn into stays readable no matter what
  // headers the asset protocol sends. The CORS image below is the fallback for when fetch is
  // refused; the plain image after that is the last resort, drawable but not readable.
  try {
    const blob = await fetch(url).then((response) => response.blob());
    const objectUrl = URL.createObjectURL(blob);
    const bitmap = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("blob decode failed"));
      image.src = objectUrl;
    });
    return bitmap;
  } catch (error) {
    // fall through to the image element
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => {
      // Retry without CORS: the picture is still drawable, and a pack that renders with no checks
      // is far more useful than an empty page with one error on it.
      const plain = new Image();
      plain.onload = () => resolve(plain);
      plain.onerror = () => reject(new Error(`could not load ${url}`));
      plain.src = url;
    };
    image.src = url;
  });
}

/// Read one cell's alpha mask, aligned to its own floor line and horizontal centre.
///
/// The alignment is what makes two poses comparable: without it, sliding the whole figure sideways
/// counts as a difference, and every walk row looks distinct from idle whether or not it is.
function maskOf(ctx, geometry, row, col) {
  const { cellWidth: w, cellHeight: h } = geometry;
  const { data } = ctx.getImageData(col * w, row * h, w, h);
  const mask = new Uint8Array(w * h);
  let count = 0, top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > ALPHA) {
        mask[y * w + x] = 1;
        count += 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (count < 120) return null;
  const shiftY = h - 1 - bottom;
  const shiftX = Math.round(w / 2 - (left + right) / 2);
  const aligned = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const ny = y + shiftY;
    if (ny < 0 || ny >= h) continue;
    for (let x = 0; x < w; x += 1) {
      const nx = x + shiftX;
      if (nx < 0 || nx >= w) continue;
      aligned[ny * w + nx] = mask[y * w + x];
    }
  }
  // body top: the first row at least 35% as wide as the widest — ears, tails and antennae are not
  // the top of the head, and measuring the bounding box instead reports a raised tail as growth
  let widest = 0;
  const widths = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    let run = 0;
    for (let x = 0; x < w; x += 1) run += aligned[y * w + x];
    widths[y] = run;
    if (run > widest) widest = run;
  }
  let bodyTop = h - 1;
  for (let y = 0; y < h; y += 1) {
    if (widths[y] >= widest * 0.35) { bodyTop = y; break; }
  }
  return {
    mask: aligned, count, top, bottom, left, right,
    bodyHeight: h - bodyTop,
    touchesEdge: left === 0 || right === w - 1
  };
}

function distance(a, b) {
  let diff = 0;
  for (let i = 0; i < a.mask.length; i += 1) diff += a.mask[i] ^ b.mask[i];
  return diff / Math.max(1, a.count);
}

async function analyse(pet) {
  const geometry = geometryOf(pet);
  const url = pet.spritesheetUrl || (convertFileSrc ? convertFileSrc(pet.spritesheetPath) : pet.spritesheetPath);
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  // Can the pixels be read at all? Ask once, cheaply, instead of letting the first check throw.
  // When they cannot, the rows are still drawn and the checks are reported as unavailable — a pack
  // shown without checks beats a blank page.
  let readable = true;
  try {
    ctx.getImageData(0, 0, 1, 1);
  } catch (error) {
    readable = false;
  }

  const rows = [];
  for (const [id, row, fallback] of STATE_ROWS) {
    const timing = timingOf(pet, id, fallback);
    const cells = [];
    for (let col = 0; col < timing.frames; col += 1) {
      cells.push(readable && col * geometry.cellWidth + geometry.cellWidth <= image.width
        ? maskOf(ctx, geometry, row, col)
        : null);
    }
    rows.push({ id, row, timing, cells });
  }

  if (!readable) {
    return { pet, geometry, image, rows, issues: [{ level: "warn", text: RU.issue.notReadable }] };
  }

  const idle = rows[0].cells.filter(Boolean);
  const issues = [];
  for (const entry of rows) {
    const filled = entry.cells.filter(Boolean);
    if (entry.timing.frames > 0 && filled.length === 0) {
      issues.push({ level: "bad", text: RU.issue.emptyRow(entry.id, entry.timing.frames) });
      entry.verdict = "empty";
      continue;
    }
    if (entry.timing.frames === 0) { entry.verdict = "not drawn"; continue; }
    if (filled.length < entry.cells.length) {
      issues.push({ level: "warn", text: RU.issue.blankFrames(entry.id, entry.cells.length - filled.length, entry.cells.length) });
    }
    const clipped = filled.filter((cell) => cell.touchesEdge).length;
    if (clipped) {
      issues.push({ level: "bad", text: RU.issue.clipped(entry.id, clipped) });
    }
    const heights = filled.map((cell) => cell.bodyHeight);
    const spread = heights.length > 2
      ? (Math.max(...heights) - Math.min(...heights)) / (heights.reduce((a, b) => a + b, 0) / heights.length)
      : 0;
    entry.spread = spread;
    if (spread > 0.06) {
      issues.push({ level: "warn", text: RU.issue.heightWander(entry.id, (spread * 100).toFixed(0)) });
    }
    if (idle.length && entry.id !== "idle") {
      const value = filled.reduce((sum, cell) =>
        sum + Math.min(...idle.map((other) => distance(cell, other))), 0) / Math.max(1, filled.length);
      entry.distance = value;
      if (value < 0.08) {
        const walk = entry.id.startsWith("running");
        issues.push({
          level: walk ? "bad" : "warn",
          text: walk ? RU.issue.walkIsIdle(entry.id, value.toFixed(3))
                     : RU.issue.poseIsIdle(entry.id, value.toFixed(3))
        });
      }
    }
    entry.verdict = "ok";
  }

  // anchors: head_top must sit inside the silhouette, between its top and the eyes
  const anchors = pet.anchors;
  if (anchors?.head_top && idle.length) {
    const cell = idle[0];
    const headY = (anchors.head_top.y / 100) * geometry.cellHeight;
    if (headY < cell.top - geometry.cellHeight * 0.05 || headY > cell.bottom) {
      issues.push({ level: "bad", text: RU.issue.anchorOff(
        anchors.head_top.y.toFixed(1),
        (cell.top / geometry.cellHeight * 100).toFixed(1),
        (cell.bottom / geometry.cellHeight * 100).toFixed(1)) });
    }
  } else if (!anchors) {
    issues.push({ level: "warn", text: RU.issue.noAnchors });
  }

  return { pet, geometry, image, rows, issues };
}

function levelOf(issues) {
  if (issues.some((issue) => issue.level === "bad")) return "bad";
  if (issues.length) return "warn";
  return "ok";
}

function renderPackList() {
  el.packs.innerHTML = "";
  for (const pet of state.pets) {
    const report = state.reports.get(pet.id);
    const level = report ? levelOf(report.issues) : "ok";
    if (el.onlyProblems.checked && level === "ok") continue;
    const button = document.createElement("button");
    button.className = "pack";
    button.type = "button";
    button.setAttribute("aria-current", String(pet.id === state.current));
    button.innerHTML = `<span class="dot ${level}"></span><span>${pet.displayName || pet.id}</span>`
      + `<span class="count">${report ? report.issues.length || "" : "…"}</span>`;
    button.addEventListener("click", () => select(pet.id));
    el.packs.append(button);
  }
}

let timer = null;

function renderPack(report) {
  const { pet, geometry, image, rows, issues } = report;
  if (!image) {
    el.body.innerHTML = `<h2>${pet.displayName || pet.id}</h2>`
      + `<div class="issues"><span class="bad">${issues[0]?.text || RU.issue.notReadable}</span></div>`;
    return;
  }
  const zoom = Number(el.zoom.value);
  el.body.innerHTML = "";

  const head = document.createElement("div");
  const walks = (pet.behavior?.wanderDirections || []).some((value) => value !== 0);
  head.innerHTML = `<h2>${pet.displayName || pet.id}
      <button id="makeActive" type="button" style="margin-left:10px;font-size:12px">${RU.makeActive}</button></h2>
    <div class="meta">${RU.cell} <b>${geometry.cellWidth}×${geometry.cellHeight}</b> ·
      ${RU.columns} <b>${geometry.columns}</b> · ${RU.atlas} <b>${image.width}×${image.height}</b> ·
      ${RU.version} <b>${pet.version || "?"}</b> ·
      ${RU.wander} <b>${walks ? RU.yes : RU.no}</b> ·
      ${RU.lifeStates} <b>${(pet.behavior?.idleStates || []).map((id) => RU.stateName[id] || id).join(", ") || RU.none}</b></div>`;
  el.body.append(head);
  head.querySelector("#makeActive")?.addEventListener("click", () => {
    order({ kind: "select", petId: pet.id });
    el.status.textContent = `${pet.displayName || pet.id}: ${RU.ordered}`;
  });

  const box = document.createElement("div");
  box.className = "issues";
  box.innerHTML = issues.length
    ? `<b>${RU.findings(issues.length)}</b><ul>${issues
        .map((issue) => `<li class="${issue.level}">${issue.text}</li>`).join("")}</ul>`
    : `<span class="good">${RU.clean}</span>`;
  el.body.append(box);

  const canvases = [];
  for (const entry of rows) {
    const line = document.createElement("div");
    line.className = "row";

    const name = document.createElement("div");
    name.className = "row-name";
    name.innerHTML = `${RU.stateName[entry.id] || entry.id}`
      + `<small>${entry.timing.frames} ${RU.frames} · ${entry.timing.fps} ${RU.fps}`
      + `${entry.timing.source ? ` · ${RU.from} «${entry.timing.source}»` : ""}`
      + `${entry.distance !== undefined ? ` · ${RU.poseDelta} ${entry.distance.toFixed(3)}` : ""}`
      + `${entry.spread ? ` · ${RU.heightSpread} ±${(entry.spread * 100).toFixed(1)}%` : ""}</small>`;
    if (entry.timing.frames > 0) {
      const order = document.createElement("button");
      order.type = "button";
      order.textContent = RU.showOnPet;
      order.style.marginTop = "6px";
      order.addEventListener("click", () => {
        order({ kind: "select", petId: pet.id });
        order({ kind: "play", state: entry.id, holdMs: 8000 });
        el.status.textContent = `${RU.stateName[entry.id] || entry.id}: ${RU.ordered}`;
      });
      name.append(order);
    }
    line.append(name);

    if (entry.timing.frames === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = RU.notDrawn;
      line.append(empty, document.createElement("div"));
      el.body.append(line);
      continue;
    }

    const stage = document.createElement("div");
    stage.className = "stage";
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(geometry.cellWidth * zoom);
    canvas.height = Math.round(geometry.cellHeight * zoom);
    stage.append(canvas);
    line.append(stage);
    canvases.push({ canvas, entry });

    const strip = document.createElement("div");
    strip.className = "strip";
    for (let col = 0; col < entry.timing.frames; col += 1) {
      const thumb = document.createElement("canvas");
      const scale = 64 / geometry.cellHeight;
      thumb.width = Math.round(geometry.cellWidth * scale);
      thumb.height = 64;
      thumb.title = `frame ${col + 1}`;
      if (entry.cells[col]?.touchesEdge) thumb.classList.add("clip");
      const tctx = thumb.getContext("2d");
      tctx.imageSmoothingQuality = "high";
      tctx.drawImage(image, col * geometry.cellWidth, entry.row * geometry.cellHeight,
        geometry.cellWidth, geometry.cellHeight, 0, 0, thumb.width, thumb.height);
      strip.append(thumb);
    }
    line.append(strip);
    el.body.append(line);
  }

  if (timer) cancelAnimationFrame(timer);
  const started = performance.now();
  const draw = () => {
    const now = performance.now();
    for (const { canvas, entry } of canvases) {
      const ctx = canvas.getContext("2d");
      const frame = state.manualFrame !== null
        ? state.manualFrame % entry.timing.frames
        : Math.floor(((now - started) / 1000) * entry.timing.fps) % entry.timing.frames;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, frame * geometry.cellWidth, entry.row * geometry.cellHeight,
        geometry.cellWidth, geometry.cellHeight, 0, 0, canvas.width, canvas.height);
      if (el.showCell.checked) {
        ctx.strokeStyle = "#a32d2d";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      }
      if (el.showAnchors.checked && pet.anchors) {
        for (const [key, colour] of [["head_top", "#d05a4a"], ["eyes", "#3d6fb4"], ["neck", "#2f7a4a"]]) {
          const point = pet.anchors[key];
          if (!point) continue;
          const x = (point.x / 100) * canvas.width;
          const y = (point.y / 100) * canvas.height;
          ctx.strokeStyle = colour;
          ctx.beginPath();
          ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    if (state.playing && state.manualFrame === null) timer = requestAnimationFrame(draw);
  };
  draw();
}

async function select(id) {
  state.current = id;
  window.BugfixApp?.step?.("screen", `pack:${id}`);
  state.manualFrame = null;
  renderPackList();
  const report = state.reports.get(id);
  if (report) renderPack(report);
}

async function boot() {
  if (!invoke) {
    el.body.innerHTML = `<p class="empty">${RU.noBridge}</p>`;
    return;
  }
  state.appVersion = (await invoke("get_app_info").catch(() => null))?.version || "?";
  wireBugfix();
  const list = await invoke("list_pets");
  state.pets = (list.pets || []).map((pet) => ({
    ...pet,
    spritesheetUrl: convertFileSrc ? convertFileSrc(pet.spritesheetPath) : pet.spritesheetPath
  }));
  renderPackList();
  el.status.textContent = RU.analysing(state.pets.length);
  let bad = 0;
  for (const pet of state.pets) {
    try {
      const report = await analyse(pet);
      state.reports.set(pet.id, report);
      if (levelOf(report.issues) === "bad") bad += 1;
    } catch (error) {
      state.reports.set(pet.id, { pet, geometry: geometryOf(pet), image: null, rows: [],
        issues: [{ level: "bad", text: RU.issue.unreadable(error.message) }] });
      bad += 1;
    }
    renderPackList();
  }
  el.status.textContent = RU.summary(state.pets.length, bad);
  if (state.pets.length) select(state.current || state.pets[0].id);
}

el.zoom.addEventListener("change", () => state.current && select(state.current));
el.showAnchors.addEventListener("change", () => state.current && select(state.current));
el.showCell.addEventListener("change", () => state.current && select(state.current));
el.onlyProblems.addEventListener("change", renderPackList);
el.playPause.addEventListener("click", () => {
  state.playing = !state.playing;
  state.manualFrame = state.playing ? null : 0;
  el.playPause.textContent = state.playing ? RU.pause : RU.play;
  if (state.current) select(state.current);
});
el.stepFwd.addEventListener("click", () => {
  state.playing = false;
  el.playPause.textContent = RU.play;
  state.manualFrame = (state.manualFrame ?? 0) + 1;
  if (state.current) select(state.current);
});
el.stepBack.addEventListener("click", () => {
  state.playing = false;
  el.playPause.textContent = RU.play;
  state.manualFrame = Math.max(0, (state.manualFrame ?? 0) - 1);
  if (state.current) select(state.current);
});

/// Reporting a bug from the place where the evidence already is.
///
/// The report itself is built by the shared in-app module (APP_BUILD_RULES §3.1), vendored beside
/// this file. It was written for exactly this case and carries what a hand-rolled reporter does
/// not: an offline queue that flushes when the machine comes back, a dedup key so five taps make
/// one ticket, twenty breadcrumbs, session uptime, the version the app updated from, the WebView
/// build, and voice. This page only supplies the three contract functions — where the person was,
/// which build of this screen they were on, and what the app knows about the pack in front of them.
///
/// ⚠️ I wrote my own reporter first and had to throw it away. The module was already documented in
/// the app canon; I did not look there. What survived the move is the context below — the numbers
/// that turned out to matter more than a screenshot.
/// ⚠️ Wired from inside boot, not at module load: the app version arrives over a separate call, and
/// an init on the top level would stamp every report with "?".
function wireBugfix() {
  window.BugfixApp?.init({
  project: "mascot",
  version: state.appVersion || "?",
  button: false,
  screen: () => `inspector:${state.current || "-"}`,
  module: () => ({ id: "pose-inspector", ver: "VER 1 · 06.09.2026" }),
  context: () => {
    const report = state.reports.get(state.current);
    if (!report) return { pack: null };
    return {
      pack: report.pet.id,
      packVersion: report.pet.version,
      cell: `${report.geometry.cellWidth}x${report.geometry.cellHeight}`,
      columns: report.geometry.columns,
      walks: (report.pet.behavior?.wanderDirections || []).some((value) => value !== 0),
      lifeStates: report.pet.behavior?.idleStates || [],
      rows: report.rows.map((entry) => ({
        state: entry.id, frames: entry.timing.frames, fps: entry.timing.fps,
        source: entry.timing.source, poseDistance: entry.distance ?? null,
        heightSpread: entry.spread ?? null
      })),
      findings: report.issues.map((issue) => `${issue.level}: ${issue.text}`)
    };
  }
  });
}

el.reportTitle.textContent = RU.reportTitle;
el.reportHint.textContent = RU.reportHint;
el.reportSend.textContent = RU.reportSend;
el.reportCancel.textContent = RU.reportCancel;
el.reportButton.textContent = RU.report;
el.reportButton.addEventListener("click", () => {
  el.reportText.value = "";
  el.reportBox.showModal();
});
el.reportSend.addEventListener("click", async () => {
  const message = el.reportText.value.trim();
  if (!message) { el.reportText.focus(); el.status.textContent = RU.reportEmpty; return; }
  el.reportBox.close();
  el.status.textContent = RU.reportSending;
  const sent = await window.BugfixApp?.send("bug", message);
  el.status.textContent = sent ? RU.reportDone : RU.reportQueued;
});

boot();
