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
