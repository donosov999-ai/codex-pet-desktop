/// Bug reporting, built in rather than bolted on.
///
/// Every other project reports bugs through a one-line script tag that pulls a widget from the
/// bugfix centre. This app cannot do that: its content policy allows scripts from itself only, and
/// loosening that to run a remote script inside a window that draws the user's desktop is a poor
/// trade for a convenience. So the report is composed here and posted straight to the same store
/// the widget posts to, with the same insert-only key.
///
/// Doing it natively also buys the thing a web widget cannot know. A screenshot of a page tells you
/// what it looked like; this report carries WHY it looked that way — which pack, what cell it
/// declares, how many frames each row really holds, whether the pack walks, and what the automatic
/// checks say about it. Half the defects found in this deck were invisible on screen and obvious in
/// those numbers.

const ENDPOINT = "https://iuvvheeocobhiothfgei.supabase.co";
// Publishable key: the table grants anon INSERT and nothing else, so this is safe to ship. It
// cannot read a single row back.
const KEY = "sb_publishable_A2vJ5DjemTZIKrKX6XGqvQ_WaiuAkk1";
const PROJECT = "mascot";

/// Keep the last console errors, so a report carries what went wrong before the user noticed.
const errorLog = [];
function watchErrors() {
  const keep = (entry) => {
    errorLog.push(entry);
    if (errorLog.length > 20) errorLog.shift();
  };
  const original = console.error;
  console.error = (...args) => {
    keep({ at: new Date().toISOString(), text: args.map(String).join(" ").slice(0, 400) });
    original.apply(console, args);
  };
  window.addEventListener("error", (event) =>
    keep({ at: new Date().toISOString(), text: `${event.message} @ ${event.filename}:${event.lineno}` }));
  window.addEventListener("unhandledrejection", (event) =>
    keep({ at: new Date().toISOString(), text: `unhandled: ${String(event.reason).slice(0, 300)}` }));
}
watchErrors();

function deviceId() {
  const key = "biruzik.device-id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `desk-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch (error) {
    // Storage can throw outright in a private window; a report without a device id is still a report
    return "desk-unknown";
  }
}

async function post(path, body, extraHeaders = {}) {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extraHeaders },
    body
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response;
}

/// Upload a PNG blob to the private screenshot bucket and return its path.
///
/// The bucket is private on purpose — screenshots of someone's desktop must not be fetchable by
/// anyone holding the public key — so nothing here tries to read it back.
export async function uploadShot(blob, name) {
  const path = `${PROJECT}/${Date.now()}-${name}.png`;
  await post(`/storage/v1/object/bug-shots/${path}`, blob, { "Content-Type": "image/png" });
  return path;
}

export async function sendReport({ message, context = {}, shotPath = null, reporter = null, kind = "bug" }) {
  const body = JSON.stringify([{
    project: PROJECT,
    kind,
    message: String(message || "").slice(0, 4000),
    url: location.pathname,
    shot_path: shotPath,
    device_id: deviceId(),
    reporter,
    context: { ...context, errors: errorLog.slice(-8), reportedAt: new Date().toISOString() }
  }]);
  // ⚠️ NEVER ASK FOR THE INSERTED ROW BACK.
  //
  // `Prefer: return=representation` needs READ permission, which the publishable key does not have
  // and must not have: bug reports carry other people's screenshots and descriptions, and the key
  // ships inside every build. The refusal arrives as 42501 "permission denied for table", which
  // reads like "you may not insert" although inserting is allowed. Measured against the live table
  // on 2026-09-06: the same request with `return=minimal` answers 201.
  await post("/rest/v1/bug_reports", body, {
    "Content-Type": "application/json",
    Prefer: "return=minimal"
  });
  return true;
}

/// Everything about the app worth knowing when something looks wrong.
export function appContext({ appInfo, pet, geometry, states, findings } = {}) {
  return {
    app: { version: appInfo?.version || "?", window: `${window.innerWidth}x${window.innerHeight}` },
    pet: pet
      ? {
          id: pet.id,
          version: pet.version,
          cell: geometry ? `${geometry.cellWidth}x${geometry.cellHeight}` : null,
          columns: geometry?.columns ?? null,
          walks: (pet.behavior?.wanderDirections || []).some((value) => value !== 0),
          lifeStates: pet.behavior?.idleStates || [],
          rows: states || null
        }
      : null,
    findings: findings || null,
    platform: navigator.platform,
    language: navigator.language
  };
}
