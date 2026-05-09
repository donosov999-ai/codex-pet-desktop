const path = require("node:path");
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const { defaultPetRoots, listPets } = require("./pets");
const { clampLooseWindowPosition } = require("./windowBounds");

let mainWindow;
let tray;
let alwaysOnTop = true;
let mouseEventsIgnored = false;

function getBundledPetsDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "pets")
    : path.join(__dirname, "..", "resources", "pets");
}

function getPetData() {
  const roots = defaultPetRoots({
    app,
    bundledPetsDir: getBundledPetsDir(),
    packagedResourcesDir: process.resourcesPath
  });
  return {
    roots,
    ...listPets(roots)
  };
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="#20242b"/>
      <path d="M8 18c0-5 3-9 8-9 5 0 8 4 8 9 0 4-3 7-8 7s-8-3-8-7z" fill="#b38351"/>
      <path d="M11 10 8 6l1 6M21 10l3-4-1 6" fill="#7a5639"/>
      <path d="M12 15c2-2 6-2 8 0" stroke="#2b211a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="17" r="1.5" fill="#111"/>
      <circle cx="20" cy="17" r="1.5" fill="#111"/>
      <path d="M14 21c1.5 1 2.5 1 4 0" stroke="#111" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml,${encodeURIComponent(svg)}`);
}

function setMouseEventsIgnored(ignored) {
  if (!mainWindow || mouseEventsIgnored === ignored) {
    return mouseEventsIgnored;
  }
  mouseEventsIgnored = ignored;
  mainWindow.setIgnoreMouseEvents(ignored, { forward: true });
  return mouseEventsIgnored;
}

function resetWindowPosition() {
  if (!mainWindow) {
    return null;
  }
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  const current = mainWindow.getBounds();
  const next = {
    ...current,
    x: workArea.x + workArea.width - current.width - 48,
    y: workArea.y + workArea.height - current.height - 48
  };
  mainWindow.setBounds(next, false);
  return mainWindow.getBounds();
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Codex Pet Desktop");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show pet",
        click: () => {
          mainWindow?.showInactive();
        }
      },
      {
        label: "Hide pet",
        click: () => {
          mainWindow?.hide();
        }
      },
      {
        label: "Reset position",
        click: () => {
          mainWindow?.showInactive();
          resetWindowPosition();
        }
      },
      { type: "separator" },
      {
        label: "Always on top",
        type: "checkbox",
        checked: alwaysOnTop,
        click: (item) => {
          alwaysOnTop = item.checked;
          mainWindow?.setAlwaysOnTop(alwaysOnTop, "floating");
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit()
      }
    ])
  );
  tray.on("click", () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.showInactive();
    }
  });
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  const width = 320;
  const height = 340;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 48,
    y: workArea.y + workArea.height - height - 48,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(alwaysOnTop, "floating");
  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    setMouseEventsIgnored(true);
  });

  if (process.env.PET_DESKTOP_E2E === "1") {
    mainWindow.webContents.once("did-finish-load", () => {
      const petData = getPetData();
      console.log(
        JSON.stringify({
          ok: true,
          windowCreated: true,
          petCount: petData.pets.length,
          firstPet: petData.pets[0]?.id || null
        })
      );
      setTimeout(() => app.quit(), 500);
    });
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock?.hide();
  }
  createTray();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("pets:list", () => getPetData());

ipcMain.handle("window:move-by", (_event, delta) => {
  if (!mainWindow) {
    return null;
  }
  const current = mainWindow.getBounds();
  const display = screen.getDisplayMatching(current);
  const { workArea } = display;
  const next = clampLooseWindowPosition(
    current,
    workArea,
    current.x + Math.round(delta.x || 0),
    current.y + Math.round(delta.y || 0)
  );
  mainWindow.setBounds({ ...current, ...next }, false);
  return mainWindow.getBounds();
});

ipcMain.handle("window:set-ignore-mouse-events", (_event, ignored) => {
  return setMouseEventsIgnored(Boolean(ignored));
});

ipcMain.handle("window:reset-position", () => resetWindowPosition());

ipcMain.handle("window:set-always-on-top", (_event, value) => {
  alwaysOnTop = Boolean(value);
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(alwaysOnTop, "floating");
  }
  return alwaysOnTop;
});

ipcMain.handle("window:get-state", () => ({ alwaysOnTop }));

ipcMain.handle("app:quit", () => {
  app.quit();
});
