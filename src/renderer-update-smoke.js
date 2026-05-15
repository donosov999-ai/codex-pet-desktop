const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    if (force === undefined ? !this.values.has(value) : force) {
      this.values.add(value);
      return true;
    }
    this.values.delete(value);
    return false;
  }
}

function createFakeElement(selector) {
  const listeners = new Map();
  return {
    selector,
    style: {
      setProperty(name, value) {
        this[name] = value;
      }
    },
    classList: new FakeClassList(),
    children: [],
    checked: selector === "#wanderToggle" || selector === "#topToggle",
    disabled: false,
    value: "",
    textContent: "",
    files: [],
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.({ target: this, ...event });
    },
    append(...children) {
      this.children.push(...children);
    },
    closest(targetSelector) {
      return targetSelector
        .split(",")
        .map((part) => part.trim())
        .includes(selector)
        ? this
        : null;
    },
    contains(target) {
      return target === this || this.children.includes(target);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    querySelector() {
      return createFakeElement(`${selector} child`);
    },
    click() {
      this.dispatch("click");
    },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function main() {
  const selectors = [
    "#pet",
    "#emptyState",
    "#panel",
    "#panelBackdrop",
    "#petSelect",
    "#stateSelect",
    "#scaleRange",
    "#wanderToggle",
    "#topToggle",
    "#importButton",
    "#importEmptyButton",
    "#petpackInput",
    "#petManager",
    "#petStatus",
    "#checkUpdateButton",
    "#openDownloadsButton",
    "#updateStatus",
    "#quitButton"
  ];
  const elements = new Map(selectors.map((selector) => [selector, createFakeElement(selector)]));
  elements.get("#panel").classList.add("hidden");

  const openCalls = [];
  const fetchCalls = [];
  const context = {
    console,
    performance: { now: () => 0 },
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    requestAnimationFrame() {},
    fetch: async (url) => {
      fetchCalls.push(url);
      return {
        ok: true,
        json: async () => ({
          tag_name: "v0.2.1",
          html_url: "https://github.com/jieyangxchen/codex-pet-desktop/releases/tag/v0.2.1"
        })
      };
    },
    document: {
      documentElement: createFakeElement("html"),
      createElement: (tag) => createFakeElement(tag),
      querySelector: (selector) => elements.get(selector),
      addEventListener() {}
    },
    window: {
      petDesktop: {
        listPets: async () => ({ pets: [], errors: [] }),
        importPetpack: async () => {
          throw new Error("not used");
        },
        uninstallPet: async () => ({ pets: [], errors: [] }),
        revealPet: async () => {},
        getAppInfo: async () => ({
          version: "0.2.0",
          latestReleaseApi: "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest",
          downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/"
        }),
        openDownloads: async () => {
          openCalls.push("downloads");
        },
        moveBy: async () => {},
        setIgnoreMouseEvents: async () => {},
        resetPosition: async () => {},
        setAlwaysOnTop: async () => {},
        getWindowState: async () => ({ alwaysOnTop: true }),
        quit: () => {}
      },
      clearTimeout() {},
      setTimeout() {
        return 1;
      },
      addEventListener() {},
      __TAURI__: undefined
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.requestAnimationFrame = context.requestAnimationFrame;
  context.window.fetch = context.fetch;

  const source = fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8");
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "renderer.js" });
  await flush();

  elements.get("#checkUpdateButton").click();
  await flush();

  const updateText = elements.get("#updateStatus").textContent;
  if (!fetchCalls[0]?.includes("/releases/latest") || !updateText.includes("v0.2.1")) {
    console.error(JSON.stringify({ ok: false, reason: "update check did not report latest release", fetchCalls, updateText }));
    process.exit(1);
  }

  elements.get("#openDownloadsButton").click();
  await flush();

  if (openCalls[0] !== "downloads") {
    console.error(JSON.stringify({ ok: false, reason: "downloads button did not call backend", openCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, updateText, openCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
