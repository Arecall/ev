const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenRecorder", {
  getSources: () => ipcRenderer.invoke("capture:sources"),
  showCountdown: () => ipcRenderer.invoke("recording:countdown"),
  showRecordingWidget: () => ipcRenderer.invoke("recording:widget-show"),
  closeRecordingWidget: () => ipcRenderer.invoke("recording:widget-close"),
  updateRecordingWidgetLevel: (level) => ipcRenderer.invoke("recording:widget-level", level),
  saveRecording: (buffer, options = {}) => ipcRenderer.invoke("recording:save", { buffer, ...options }),
  showFile: (filePath) => ipcRenderer.invoke("recording:show-file", filePath),
  onStopRequest: (callback) => {
    ipcRenderer.on("recording:stop-request", callback);
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
  },
});
