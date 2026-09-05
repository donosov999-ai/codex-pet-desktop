# Dev harness

`growth-check.html` — a bench for the growth layer, served statically from `src/app`:

    http://localhost:4181/dev/growth-check.html

It mounts `growth-layer.js` on a stand-in pet and lets you spend acts of care, so levels, the
five named forms, the progress ring and the promotion card can be checked without building the
app or installing a pack.

Run on 2026-09-05 over 130 acts of care: the form changed at levels 3, 5, 7 and 9 exactly as the
ladder says, the ring filled and reset within each level and stayed full at the top, the
promotion card appeared only when the form changed, and the sprite kept its size throughout —
growth reads as a change of form, which is the whole point.

Two defects surfaced here rather than in front of a user: the layer resolved the vendored engine
against the page instead of against its own module, and this bench drew the pet invisible through
a bad background shorthand. Both are fixed; the first one mattered.

Not part of the product UI. It ships in the bundle only because everything under `src/app` does,
and it is a couple of kilobytes.

`app-preview.html` — the real renderer under a stubbed desktop bridge, for questions about pixels
that a fake DOM cannot answer and a Rust build answers too slowly:

    http://localhost:4181/src/app/dev/app-preview.html

Serve the repository ROOT, not `src/app`: the page needs both the app and `resources/pets`.

🔴 Freeze transitions before measuring. `#pet` transitions its transform over 600ms and inside the
iframe that transition never completes, so `getComputedStyle` keeps returning the value the pet
started from. A run on 2026-09-05 read every slider position as scale 0.9 and made a correct
layout look broken. The tell is a measured scale that disagrees with the slider.

Vertical layout after the bottom anchor (biruzik, transitions frozen):

| slider | window  | clear above head | gap under feet | clipped |
|--------|---------|------------------|----------------|---------|
| 0.6    | 188×201 | 38               | 38             | no      |
| 0.9    | 245×264 | 39               | 38             | no      |
| 1.4    | 341×368 | 39               | 38             | no      |
| 1.8    | 418×451 | 39               | 38             | no      |

Before the anchor the same four rows read 205px of dead space under the feet at 1.8 and the head
cut off entirely once the height formula was simple. Both are gone.

Ring and card, checked on the same bench (transitions frozen, progress forced to 0.62):

| slider | window  | ring          | margin to frame | card       | card top |
|--------|---------|---------------|-----------------|------------|----------|
| 0.6    | 188×201 | 129×140       | 27–31           | 123×24     | 8        |
| 0.9    | 245×264 | 194×210       | 26–28           | 123×24     | 8        |
| 1.4    | 341×368 | 301×326       | 20–21           | 123×24     | 8        |
| 1.8    | 418×451 | 387×419       | 15–16           | 123×24     | 8        |

The ring hugs the pet and scales with it, which is what it is for. The card does not: it is a
notice for the person, so it sits on the stage at a fixed type size. As a child of #pet it was
222px wide at 1.8 and its top sat 42px above the window — the one moment growth has something to
say was the one moment it could not be read.

⚠️ The bench force-reloads the renderer's modules before each mount. Query strings on the tags in
renderer.html do not reach modules those files import by relative path, and a run measuring the
old growth layer against the new CSS reads as a fix that did not work.

Restore after the webview's storage is wiped (`window.__careCount` sets the saved count, then
clear local storage and mount):

| acts of care | experience | level | promotion card |
|--------------|------------|-------|----------------|
| 0            | 0          | 1     | silent         |
| 12           | 60         | 3     | silent         |
| 40           | 200        | 5     | silent         |
| 124          | 620        | 9     | silent         |

The count is the truth and the engine's tally is a cache of it, so a cleared profile costs nothing.
The card stays silent on a restore — it announces a form the pet has just reached, not one it
already had.

Earned things, checked with 40 acts of care (level 5, all three rules met):

| item      | anchor    | placed at   | width |
|-----------|-----------|-------------|-------|
| scarf     | neck      | 50.8 / 52.4 | 30%   |
| glasses   | eyes      | 51.9 / 24.2 | 38%   |
| party_hat | head_top  | 51.9 / 6.7  | 44%   |

All three land on the cat. Only packs with an `anchors` field wear anything, and today that is
biruzik, panda and typerighting — the three whose measured points were checked by eye. The rest
stay bare on purpose: a guessed position puts a scarf across the face.

⚠️ The bench re-fetches `pet.json` with `cache: "reload"` as well as the modules. Anchors were
written into the pack and the first run still reported none, because the browser served the file
it already had.
