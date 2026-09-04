/* Growth for the desktop pet: named forms and a progress ring, not a bigger sprite.
 *
 * WHY THIS REPLACES WHAT WAS HERE. The app grew the pet by SCALING it: `growthFactor()` walked
 * from 0.7x to 1.3x as care actions accumulated, and `--growth` fed the CSS transform. The owner
 * rejected that model on 2026-08-16 — growth should read as a change of FORM, the way a character
 * earns a new named stage, not as the same drawing getting larger. The web engine was rebuilt
 * around that decision (levels, named forms, aura, glowing eyes, levitation, a progress ring, a
 * card on promotion); the app kept the rejected model and none of the new one.
 *
 * WHY NO RENDERER SWAP. Sharing the whole web engine here means replacing `animation.js`, and
 * that module also runs the care loop, the typing-alongside behaviour, directions and autonomous
 * states. Swapping it wholesale risks the mature parts of a shipping app for a visual gain.
 * The growth model does not need the swap: `__ODVMASCOT` (addXP, growth, FORMS, tierOf, STEPS)
 * is exported at the engine's top level and works as soon as the file is loaded, with no `init`
 * and no sprite of its own. So the app keeps drawing its own pet and borrows only the model —
 * one definition of levels and forms across web, desktop and mobile instead of three.
 *
 * FAILS SOFT BY DESIGN. If the engine file is missing or fails to parse, every call here turns
 * into a no-op and the app behaves exactly as before. Growth is a decoration; it must never be
 * the reason a pet stops appearing.
 */

// ⚠️ RESOLVED AGAINST THIS MODULE, NOT THE PAGE. A plain "./vendor/biryuzik.js" is resolved
// relative to the document that loaded the script, so it worked from src/app/index.html and
// broke the moment the same module was opened from src/app/dev/ — the layer silently reported
// "unavailable" and the pet lost its growth with no error anywhere. The engine sits next to this
// file's folder, and that relationship holds wherever the page lives.
const ENGINE = new URL("../vendor/biryuzik.js", import.meta.url).href;

/** Archetype decides which set of form names a pack uses. Packs may declare it; otherwise guess. */
function archetypeOf(pet) {
  const declared = pet?.look || pet?.archetype || pet?.growth?.style;
  if (declared && ["sage", "tech", "beast", "spirit"].includes(declared)) {
    return declared;
  }
  const tags = `${pet?.id || ""} ${(pet?.tags || []).join(" ")}`.toLowerCase();
  if (/robot|droid|pump|walker|ovo|scout|asibots|tech/.test(tags)) return "tech";
  if (/dragon|phoenix|ghost|star|crystal|slime|alien|unicorn|spirit/.test(tags)) return "spirit";
  if (/sage|fydao|wizard|elder/.test(tags)) return "sage";
  return "beast";
}

function loadEngine() {
  if (window.__ODVMASCOT?.growth) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    // ⚠️ ALWAYS RESOLVES. A script tag that never fires load or error leaves the promise pending
    // forever, and anything awaiting it stops there. That is not hypothetical: attaching this
    // layer with an `await` made "Renderer import cache smoke" hang at boot, so the import flow
    // never bound and the suite reported 0 inspect calls. The same happens to a real user behind
    // a blocked file or a stalled disk. A decoration must never be able to hold up startup.
    // ⚠️ NO TIMER HERE, ON PURPOSE. The first version capped the wait with setTimeout, and that
    // timer became part of the app's timer surface: "Renderer life integration smoke" fires the
    // LAST registered timeout, so it started firing this one instead of the autonomous-movement
    // timer it meant to, and the pet was never configured when the test clicked it. A flaky test
    // (2 failures in 10 before this layer existed) turned into a certain one.
    // The cap is not needed any more either: nothing awaits this promise — boot moved on the
    // moment attachGrowth was called — so a script that never settles costs a pending promise and
    // a pet without growth, which is exactly the intended soft failure. A decoration must not put
    // anything on a timer queue that the product's own logic reasons about.
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    const element = document.createElement("script");
    element.src = ENGINE;
    element.async = true;
    element.onload = () => done(Boolean(window.__ODVMASCOT?.growth));
    element.onerror = () => done(false);
    try {
      document.head.appendChild(element);
    } catch {
      done(false);
    }
  });
}

function styles() {
  if (document.getElementById("growth-layer-style")) return;
  const css = document.createElement("style");
  css.id = "growth-layer-style";
  // The ring sits behind the pet and never intercepts clicks: the pet stays draggable.
  css.textContent = `
    .growth-ring{position:absolute;inset:-6%;pointer-events:none;z-index:-1;border-radius:50%;
      background:conic-gradient(var(--growth-ink,#8b7ad6) calc(var(--growth-progress,0)*360deg),
                                transparent 0);
      -webkit-mask:radial-gradient(circle,transparent 61%,#000 62%);
      mask:radial-gradient(circle,transparent 61%,#000 62%);opacity:.75;transition:opacity .3s}
    /* 🔴 THE CARD LIVES OUTSIDE THE PET, and that is not a detail.
       It used to be a child of #pet, which carries the size transform — so the notice scaled with
       the sprite: 222px wide and unreadable-small at the other end of the slider, text stretched
       by a transform meant for a drawing. Worse, it was positioned above the pet's box, and the
       window only keeps 38px clear above the head: measured at slider 1.8 its top sat 42px ABOVE
       the frame, so the one moment growth has something to say was invisible.
       Anchored to the stage instead: fixed type size at any pet size, always inside the window. */
    .growth-card{position:absolute;left:50%;top:8px;transform:translateX(-50%) translateY(-6px);
      z-index:5;pointer-events:none;max-width:calc(100% - 16px);overflow:hidden;
      text-overflow:ellipsis;white-space:nowrap;padding:5px 11px;border-radius:999px;
      font:500 12px/1.2 system-ui,sans-serif;color:#fff;background:rgba(28,26,38,.92);
      box-shadow:0 4px 14px rgba(0,0,0,.28);opacity:0;transition:opacity .35s,transform .35s}
    .growth-card.show{opacity:1;transform:translateX(-50%) translateY(0)}`;
  document.head.appendChild(css);
}

/**
 * Attach growth to the app's own pet element.
 *
 * `host` is the element the pet is drawn in. `pet` is the installed pack (for the archetype).
 * Returns `record()` — call it wherever an act of care happens — and `state()` for the settings UI.
 */
export async function attachGrowth({ host, pet } = {}) {
  const noop = { record: () => null, state: () => null, available: false };
  if (!host) return noop;

  const ready = await loadEngine();
  if (!ready) return noop;

  const api = window.__ODVMASCOT;
  const forms = api.FORMS?.[archetypeOf(pet)] || api.FORMS?.beast || [];
  styles();

  // The ring belongs to the pet and scales with it — it is meant to hug the sprite. The card is
  // a notice for the person, so it goes on the stage, outside the transform.
  const ring = document.createElement("div");
  ring.className = "growth-ring";
  host.append(ring);
  const card = document.createElement("div");
  card.className = "growth-card";
  (host.parentElement || host).append(card);

  let shownTier = null;

  function paint(announce) {
    let growth;
    try {
      growth = api.growth();
    } catch {
      return null;
    }
    const steps = api.STEPS || [0];
    const level = growth.level || 1;
    // Progress to the NEXT level, not to the end of the ladder: a ring that barely moves for
    // days reads as broken. At the top level the ring is full and stays full.
    const from = steps[level - 1] ?? 0;
    const to = steps[level] ?? from;
    const share = to > from ? Math.min(1, (growth.xp - from) / (to - from)) : 1;
    ring.style.setProperty("--growth-progress", share.toFixed(3));

    const tier = api.tierOf ? api.tierOf(level) : 0;
    if (announce && shownTier !== null && tier !== shownTier && forms[tier]) {
      // Only a change of FORM is worth interrupting for. A level that keeps the same form is
      // already visible in the ring, and a card on every level would become wallpaper.
      card.textContent = `${forms[tier]} · level ${level}`;
      card.classList.add("show");
      setTimeout(() => card.classList.remove("show"), 4000);
    }
    shownTier = tier;
    return { level, tier, form: forms[tier] || null, xp: growth.xp, share };
  }

  paint(false);

  return {
    available: true,
    /** One act of care. Returns the new growth state, or null if the engine went away. */
    record(amount = 5) {
      try {
        api.addXP(amount, "care");
      } catch {
        return null;
      }
      return paint(true);
    },
    state: () => paint(false)
  };
}
