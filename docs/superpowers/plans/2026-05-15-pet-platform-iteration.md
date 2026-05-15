# Pet Platform Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app from a basic desktop pet runner into a maintainable main-app plus petpack platform.

**Architecture:** Implement the first batch as a local pet manager: Rust owns installed package metadata and safe filesystem operations, while the renderer owns visible status, import confirmation, and pet list controls. Follow-up batches add resource QA tooling and a generated download page backed by the petpack index.

**Tech Stack:** Tauri 2, Rust, vanilla renderer JavaScript, local Node smoke tests, GitHub Pages/Releases.

---

### Task 1: Installed Pet Metadata And Safe Management

**Files:**
- Modify: `src-tauri/src/pet_catalog.rs`
- Modify: `src-tauri/src/petpack.rs`
- Modify: `src-tauri/src/commands.rs`

- [x] Add pet metadata fields: `version`, `sourceKind`, and `canUninstall`.
- [x] Add Rust tests proving app-data pets are uninstallable, external pets are not, and `petpack.json` or `pet.json` versions are surfaced.
- [x] Add commands to uninstall a managed pet and reveal/open the pet folder.

### Task 2: Renderer Pet Manager

**Files:**
- Modify: `src/renderer.html`
- Modify: `src/renderer.css`
- Modify: `src/renderer.js`
- Add: `src/renderer-manager-smoke.js`
- Modify: `package.json`

- [x] Add a compact installed-pets list to the right-click panel.
- [x] Show version/source per pet, plus Reveal and Uninstall actions.
- [x] On import overwrite, show a clear status message with previous and new versions.
- [x] Add a JS smoke test for manager rendering, import overwrite status, and uninstall refresh.

### Task 3: Resource QA Tooling

**Files:**
- Add: `scripts/qa-petpack-assets.js`
- Modify: `scripts/build-petpacks.js`
- Modify: `package.json`

- [x] Validate every pet has `pet.json`, `spritesheet.webp`, required id/display name, and expected atlas dimensions.
- [x] Emit a machine-readable QA report under `release/petpacks/qa.json`.
- [x] Run QA before building petpacks.

### Task 4: Generated Download Page

**Files:**
- Add: `scripts/render-download-page.js`
- Modify: `docs/index.html`
- Modify: `.github/workflows/pages.yml`

- [x] Generate petpack cards from `release/petpacks/petpacks.json`.
- [x] Keep app installer links static but pet resource links data-driven.
- [x] Add smoke verification that the generated page contains all petpack file names.

### Task 5: App Update Entry

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/renderer.html`
- Modify: `src/renderer.css`
- Modify: `src/renderer.js`
- Add: `src/renderer-update-smoke.js`
- Modify: `package.json`

- [x] Expose current app version and download page metadata to the renderer.
- [x] Add a compact right-click panel section for checking the latest GitHub Release.
- [x] Add a button that opens the GitHub Pages download page from the desktop app.
- [x] Add a JS smoke test proving update discovery and download-page opening.
