const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("preferredCyyzPdc", {
  initialState: () => ipcRenderer.invoke("app:initialState"),
  checkUpdates: (stream) => ipcRenderer.invoke("updates:check", stream),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  publishTest: (options = {}) => ipcRenderer.invoke("test:publish", options),
  openTokenSettings: () => ipcRenderer.invoke("test:tokenSettings"),
  pluginAction: (folder, action, callsign) => ipcRenderer.invoke("plugin:action", folder, action, callsign),
  browseParentFolder: (currentPath) => ipcRenderer.invoke("folder:browseParent", currentPath),
  loadConfig: (installFolder) => ipcRenderer.invoke("config:load", installFolder),
  saveLocalConfig: (config) => ipcRenderer.invoke("config:saveLocal", config),
  saveInstalledConfig: (installFolder, config) => ipcRenderer.invoke("config:saveInstalled", installFolder, config),
  installPlugin: (parentFolder, config) => ipcRenderer.invoke("plugin:install", parentFolder, config),
  trackAudioStatus: (selection) => ipcRenderer.invoke("trackAudio:status", selection),
  applyTrackAudioTap: (selection) => ipcRenderer.invoke("trackAudio:applyTap", selection),
  openFolder: (folder) => ipcRenderer.invoke("folder:open", folder),
  listRecordings: (installFolder, config) => ipcRenderer.invoke("recordings:list", installFolder, config),
  playRecording: (filePath) => ipcRenderer.invoke("recordings:play", filePath),
  listStatistics: (installFolder) => ipcRenderer.invoke("statistics:list", installFolder),
  openStatistics: (filePath) => ipcRenderer.invoke("statistics:open", filePath),
  saveLatestStatistics: (installFolder) => ipcRenderer.invoke("statistics:saveLatest", installFolder),
  audioReplayCommand: (command) => ipcRenderer.invoke("audioReplay:command", command)
});
