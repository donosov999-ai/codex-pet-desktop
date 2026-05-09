const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petDesktop", {
  listPets: () => ipcRenderer.invoke("pets:list"),
  moveBy: (x, y) => ipcRenderer.invoke("window:move-by", { x, y }),
  setIgnoreMouseEvents: (ignored) => ipcRenderer.invoke("window:set-ignore-mouse-events", ignored),
  resetPosition: () => ipcRenderer.invoke("window:reset-position"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("window:set-always-on-top", value),
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  quit: () => ipcRenderer.invoke("app:quit")
});
