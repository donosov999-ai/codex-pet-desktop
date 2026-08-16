/* Shared pet engine: the app stops drawing its own pet and runs the same one the websites run.
 *
 * WHY. Until 2026-08-16 the pet was drawn by THREE independent implementations: the web engine
 * (mascot-engine/apps/web/biryuzik.js), this app (animation.js + life-engine.js) and the PsyGames
 * app (React Native). The gap widened every day. Levels and named forms, aura, glowing eyes,
 * levitation, anchor-based accessories, the progress ring, the level-up card and non-square walk
 * cells all landed in the web engine only — the apps know none of them.
 *
 * WHY THIS IS EVEN POSSIBLE. Tauri (here) and Capacitor (mobile) are webviews. The web engine
 * therefore runs inside them AS IS, with no port to another language. Porting would cost three
 * times as much and would drift apart again anyway.
 *
 * WHAT THIS FILE DOES NOT TOUCH. The app shell stays exactly where it is: window handling,
 * always-on-top, the settings panel, updates, pack import, the catalog. Only the CORE becomes
 * shared — how the pet looks, moves and lives.
 *
 * OFFLINE IS MANDATORY. The app must work with no network at all, so the engine is loaded in
 * this order:
 *   1. the copy bundled with the build — always present, works on a plane;
 *   2. if the network is reachable, a fresher build is layered on top from the channel.
 * The order matters and is not interchangeable: what certainly exists first, the improvement
 * second. Reversed, a user without network would get no pet at all.
 */

const CHANNEL = "https://mascot.asibots.pro";
const LOCAL_ENGINE = "./vendor/biryuzik.js";

/** Load the engine: bundled copy first, then a fresher one from the channel when online. */
async function loadEngine({ allowNetwork = true } = {}) {
  if (window.Biryuzik) {
    return { source: "already-loaded", version: window.Biryuzik.version };
  }

  const inject = (src) =>
    new Promise((resolve, reject) => {
      const element = document.createElement("script");
      element.src = src;
      element.async = true;
      element.onload = () => resolve(src);
      element.onerror = () => reject(new Error(`engine load failed: ${src}`));
      document.head.appendChild(element);
    });

  // 1. The bundled copy is the only option that depends on nothing.
  try {
    await inject(LOCAL_ENGINE);
  } catch (error) {
    if (!allowNetwork) {
      throw error;
    }
  }

  // 2. A fresher build from the channel. Failure here is NOT fatal: the bundled one already runs.
  if (allowNetwork) {
    try {
      const manifest = await fetch(`${CHANNEL}/channels/stable.json?t=${Math.floor(Date.now() / 60000)}`, {
        cache: "no-cache"
      }).then((response) => (response.ok ? response.json() : null));
      const version = manifest?.engine?.version;
      if (version && window.Biryuzik && window.Biryuzik.version !== version) {
        await inject(`${CHANNEL}/engine/${version}/biryuzik.js`);
        return { source: "channel", version: window.Biryuzik?.version };
      }
    } catch {
      /* no network: staying on the bundled copy is the expected path, not a failure */
    }
  }

  if (!window.Biryuzik) {
    throw new Error("shared engine unavailable");
  }
  return { source: "bundled", version: window.Biryuzik.version };
}

/**
 * Mount the pet into the app's own element.
 *
 * mountEl is the same #pet that animation.js used to draw into, so the shell notices nothing.
 * packBase is either a local unpacked pack directory or a pack path inside the channel.
 */
export async function mountSharedPet({ mountEl, packBase, skinId, lang = "en", size = 220, allowNetwork = true }) {
  if (!mountEl) {
    throw new Error("mountSharedPet: no element to mount into");
  }
  const engine = await loadEngine({ allowNetwork });

  const pet = window.Biryuzik.init({
    mount: mountEl,
    pack: packBase,
    linesBase: CHANNEL,
    gearBase: `${CHANNEL}/accessories/`,
    lang,
    size,
    id: `desktop-${skinId || "pet"}`,
    // In the app the pet roams its OWN window, not somebody else's page: corner registry and
    // widget avoidance belong to websites and would only fight the shell here.
    roam: false
  });

  return { pet, engine };
}

/** What the shared engine actually offers right now — checked on the spot, not guessed from code. */
export function sharedEngineFeatures() {
  const has = (name) => Boolean(window.__ODVMASCOT && typeof window.__ODVMASCOT[name] === "function");
  return {
    version: window.Biryuzik?.version || null,
    growth: has("addXP"),
    forms: Boolean(window.__ODVMASCOT?.FORMS),
    ring: Boolean(document.querySelector(".bz-ring")),
    accessories: has("applyUnlocks")
  };
}
