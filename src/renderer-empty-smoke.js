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
    checked: selector === "#wanderToggle" || selector === "#topToggle",
    value: "",
    textContent: "",
    files: [],
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
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
      return target === this;
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
    click() {},
    setPointerCapture() {},
    releasePointerCapture() {}
  };
}

async function main() {
  const elements = new Map(
    [
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
      "#quitButton"
    ].map((selector) => [selector, createFakeElement(selector)])
  );
  elements.get("#panel").classList.add("hidden");

  const timeouts = [];
  const moveCalls = [];
  const passthroughCalls = [];
  const context = {
    console,
    performance: { now: () => 0 },
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    requestAnimationFrame() {},
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
        moveBy: (...args) => moveCalls.push(args),
        setIgnoreMouseEvents: (ignored) => passthroughCalls.push(ignored),
        resetPosition: async () => {},
        setAlwaysOnTop: async () => {},
        getWindowState: async () => ({ alwaysOnTop: true }),
        quit: () => {}
      },
      clearTimeout() {},
      setTimeout(callback) {
        timeouts.push(callback);
        return timeouts.length;
      },
      addEventListener() {},
      __TAURI__: undefined
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.requestAnimationFrame = context.requestAnimationFrame;

  const source = fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8");
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "renderer.js" });
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));

  if (timeouts.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "empty state scheduled wander", timeouts: timeouts.length }));
    process.exit(1);
  }

  if (moveCalls.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "empty state moved window", moveCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, passthroughCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
