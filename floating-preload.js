const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("floatingRecorder", {
  stop: () => ipcRenderer.invoke("recording:stop-from-widget"),
  onLevel: (callback) => ipcRenderer.on("recording:level", (_event, level) => callback(level)),
});
