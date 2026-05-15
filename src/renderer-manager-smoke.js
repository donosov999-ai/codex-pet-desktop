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
    dataset: {},
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

function textOf(element) {
  return [element.textContent, ...(element.children || []).map(textOf)].join(" ");
}

function findByText(element, text) {
  if (element.textContent.includes(text)) {
    return element;
  }
  for (const child of element.children || []) {
    const found = findByText(child, text);
    if (found) {
      return found;
    }
  }
  return null;
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
    "#quitButton"
  ];
  const elements = new Map(selectors.map((selector) => [selector, createFakeElement(selector)]));
  elements.get("#panel").classList.add("hidden");

  const oldPet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    root: "/pets/mi-fen",
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    spritesheetRevision: "old"
  };
  const newPet = { ...oldPet, version: "1.0.2", spritesheetRevision: "new" };
  const uninstallCalls = [];

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
          displayName: "米粉",
          version: "1.0.2",
          replaced: true,
          previousVersion: "1.0.1",
          pets: { pets: [newPet], errors: [] }
        }),
        uninstallPet: async (id) => {
          uninstallCalls.push(id);
          return { pets: [], errors: [] };
        },
        revealPet: async () => {},
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

  const managerText = textOf(elements.get("#petManager"));
  if (!managerText.includes("米粉") || !managerText.includes("1.0.1") || !managerText.includes("managed")) {
    console.error(JSON.stringify({ ok: false, reason: "manager did not render pet metadata", managerText }));
    process.exit(1);
  }

  const petpackInput = elements.get("#petpackInput");
  petpackInput.files = [{ arrayBuffer: async () => new ArrayBuffer(0) }];
  petpackInput.dispatch("change");
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));

  const statusText = elements.get("#petStatus").textContent;
  if (!statusText.includes("已覆盖") || !statusText.includes("1.0.1") || !statusText.includes("1.0.2")) {
    console.error(JSON.stringify({ ok: false, reason: "import overwrite status missing", statusText }));
    process.exit(1);
  }

  const uninstallButton = findByText(elements.get("#petManager"), "Uninstall");
  if (!uninstallButton) {
    console.error(JSON.stringify({ ok: false, reason: "missing uninstall button", managerText: textOf(elements.get("#petManager")) }));
    process.exit(1);
  }
  uninstallButton.click();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));

  if (uninstallCalls[0] !== "mi-fen") {
    console.error(JSON.stringify({ ok: false, reason: "uninstall did not call backend", uninstallCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, statusText, uninstallCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
