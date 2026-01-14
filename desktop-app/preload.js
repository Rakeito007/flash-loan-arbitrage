// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startBot: () => ipcRenderer.invoke('start-bot'),
  stopBot: () => ipcRenderer.invoke('stop-bot'),
  getBotStatus: () => ipcRenderer.invoke('get-bot-status'),
  getContractInfo: () => ipcRenderer.invoke('get-contract-info'),
  onBotOutput: (callback) => ipcRenderer.on('bot-output', (event, data) => callback(data)),
  onBotStatus: (callback) => ipcRenderer.on('bot-status', (event, status) => callback(status)),
});
