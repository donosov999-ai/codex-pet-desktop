# Dev harness

`growth-check.html` — a bench for the growth layer, opened over a static server on `src/app`:

    http://localhost:4181/dev/growth-check.html

It mounts `growth-layer.js` on a stand-in pet and lets you spend acts of care, so levels, the
five named forms, the progress ring and the promotion card can be checked without building the
app or installing a pack. Run 2026-09-05: forms changed at levels 3, 5, 7 and 9 exactly as the
ladder says, the ring filled and reset per level and stayed full at the top, and the sprite kept
its size — growth reads as a change of form, which is the point.

Not part of the product UI; it ships in the bundle only because everything under `src/app` does,
and it is a couple of kilobytes.
