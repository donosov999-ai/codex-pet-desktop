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
