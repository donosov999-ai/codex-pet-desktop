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

  const oldPet = {
    id: "mi-fen",
    displayName: "米粉",
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    spritesheetRevision: "old"
  };
  const newPet = { ...oldPet, spritesheetRevision: "new" };

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
        listPets: async () => ({ pets: [oldPet], errors: [] }),
        importPetpack: async () => ({
          importedPetId: "mi-fen",
          pets: { pets: [newPet], errors: [] }
        }),
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
      __TAURI__: {
        core: {
          convertFileSrc: (value) => `asset://localhost${value}`
        }
      }
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

  const petpackInput = elements.get("#petpackInput");
  petpackInput.files = [{ arrayBuffer: async () => new ArrayBuffer(0) }];
  petpackInput.dispatch("change");
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));

  const background = elements.get("#pet").style.backgroundImage;
  if (!background.includes("spriteRevision=new")) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "import did not bust spritesheet cache",
        background
      })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, background }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
