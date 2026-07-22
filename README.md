<h1 align="center">Pet Forever Project</h1>

<p align="center">
  A standalone Windows and macOS desktop-pet app. The app and pet packs are independent, so pets can be installed, preserved, and updated as portable <code>.petpack</code> files.
</p>

<p align="center">
  <a href="https://donosov999-ai.github.io/codex-pet-desktop/">Download page</a> ·
  <a href="https://github.com/donosov999-ai/codex-pet-desktop/releases/latest">Latest release</a> ·
  <a href="https://donosov999-ai.github.io/codex-pet-desktop/petpacks/petpacks.json">Pet-pack index</a> ·
  <a href="https://donosov999-ai.github.io/codex-pet-desktop/petpacks/visual-qa.html">Visual QA</a>
</p>

<p align="center">
  <a href="https://github.com/donosov999-ai/codex-pet-desktop/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/donosov999-ai/codex-pet-desktop?label=release"></a>
  <a href="https://github.com/donosov999-ai/codex-pet-desktop/actions/workflows/release.yml"><img alt="Release workflow" src="https://github.com/donosov999-ai/codex-pet-desktop/actions/workflows/release.yml/badge.svg"></a>
  <a href="https://github.com/donosov999-ai/codex-pet-desktop/actions/workflows/pages.yml"><img alt="Pages workflow" src="https://github.com/donosov999-ai/codex-pet-desktop/actions/workflows/pages.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

> This is a community project, not an official OpenAI or Codex application. It supports Codex-style `pet.json` and `spritesheet.webp` resources, but it runs independently from Codex.

## Start in three steps

1. Download the installer from the [download page](https://donosov999-ai.github.io/codex-pet-desktop/) or [latest release](https://github.com/donosov999-ai/codex-pet-desktop/releases/latest).
2. Start the app and install a pet from the catalog, or import a local `.petpack` file.
3. Drag the pet into position. Right-click it to open controls for size, animation, wandering, care actions, updates, and installed pets.

## What is included

- A transparent Tauri/Rust desktop window with drag, tray, animation, care, and autonomous behavior.
- A built-in catalog backed by GitHub Pages.
- Portable `.petpack` import, update, compatibility, integrity, and uninstall flows.
- Independent app releases and pet-pack releases.
- Biruzik care modes: sleep, eat, wash, play, and toilet.

Current pet packs: Biruzik, Hong Tang, Hong Tang Realistic, Lingling, Mi Fen, Mi Jiu, Shubiao, and Tiantian.

## Downloads

| Package | Link |
| --- | --- |
| Windows x64 | [biruzik-desktop-windows-x64.exe](https://github.com/donosov999-ai/codex-pet-desktop/releases/latest/download/biruzik-desktop-windows-x64.exe) |
| Apple Silicon macOS | [biruzik-desktop-macos-arm64.dmg](https://github.com/donosov999-ai/codex-pet-desktop/releases/latest/download/biruzik-desktop-macos-arm64.dmg) |
| Pet-pack index | [petpacks.json](https://donosov999-ai.github.io/codex-pet-desktop/petpacks/petpacks.json) |
| Pet visual QA | [visual-qa.html](https://donosov999-ai.github.io/codex-pet-desktop/petpacks/visual-qa.html) |

If no pet is installed on first launch, the app opens the catalog automatically.

## Controls

| Input | Behavior |
| --- | --- |
| Drag pet | Move the pet and pause autonomous movement while dragging |
| Single click | Play the configured click interaction |
| Double click | Play the configured double-click interaction |
| Right click | Open or close the control panel |
| Left-click tray icon | Show or hide the pet |
| Right-click tray icon | Open recovery and app controls |

The tray menu can show, hide, or recenter the pet; pause or resume wandering; open the catalog or data folder; toggle always-on-top; and quit.

## Pet resource format

Each source pet lives in `resources/pets/<pet-id>/` and contains at least:

```text
pet.json
spritesheet.webp
```

A `.petpack` is a zip container with these root files:

```text
petpack.json
pet.json
spritesheet.webp
```

Minimal `petpack.json`:

```json
{
  "format": "codex-petpack",
  "formatVersion": 1,
  "id": "mi-fen",
  "displayName": "Mi Fen",
  "version": "1.0.5"
}
```

Standard atlas layout:

| Property | Value |
| --- | --- |
| Image size | `1536x1872` |
| Grid | 8 columns × 9 rows |
| Frame size | `192x208` |

| Row | State | Frames |
| --- | --- | --- |
| 0 | `idle` | 6 |
| 1 | `running-right` | 8 |
| 2 | `running-left` | 8 |
| 3 | `waving` | 4 |
| 4 | `jumping` | 5 |
| 5 | `failed` | 8 |
| 6 | `waiting` | 6 |
| 7 | `running` | 6 |
| 8 | `review` | 6 |

## Development

Requirements: Node.js 22, stable Rust, and Tauri CLI v2.

```bash
npm install
npm run check
npm run smoke

cd src-tauri
cargo test
cargo run
```

Build the app:

```bash
node scripts/build-app.js build windows
node scripts/build-app.js build macos-arm64
```

Build pet packs and the download page:

```bash
node scripts/build-petpacks.js
node scripts/render-download-page.js
```

## Project layout

```text
resources/pets/                 Pet-pack sources
src-tauri/                      Rust/Tauri process, window, tray, and packaging
src/app/                        Renderer bundled into the desktop app
src/*-smoke.js                  Node smoke tests
scripts/build-app.js            App installer build
scripts/build-petpacks.js       Pet-pack and index build
scripts/qa-petpack-assets.js    Manifest, atlas, and animation validation
scripts/render-download-page.js GitHub Pages renderer
docs/index.html                 Generated download page
```

## Release model

- A `v*` tag triggers the app release workflow for Windows and macOS installers.
- Changes under `resources/pets/**` or to page-generation scripts trigger the Pages workflow.
- The installed app checks this fork's releases and pet-pack index.

## Credits

Forked from [jieyangxchen/codex-pet-desktop](https://github.com/jieyangxchen/codex-pet-desktop). Biruzik and the English-only fork are maintained by Denis Onosov (ODV999).

## License

MIT. Individual pet packs retain the license declared in their manifest.
