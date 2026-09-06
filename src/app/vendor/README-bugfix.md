# bugfix-app.js — vendored, do not edit here

Source of truth: `https://bugfix.asibots.pro/bugfix-app.js`, owned by the webcheck channel and
documented in `APP_BUILD_RULES §3.1`. This copy is refreshed with `curl`, never patched in place —
a vendored file that drifts from its source is worse than no vendored file at all.

It is vendored rather than loaded because the app's content policy allows scripts from itself only,
and because a desktop app has to keep working with no network: the module queues reports in local
storage and flushes them when the machine comes back online.

Wiring lives in `src/app/inspector.js`: headless mode (`button: false`), our own button, and the
three contract functions `screen()`, `module()` and `context()`.
