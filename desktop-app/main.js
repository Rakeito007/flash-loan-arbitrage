const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let botProcess = null;
let botStatus = 'stopped';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // Optional icon
    titleBarStyle: 'hiddenInset', // macOS style
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop bot if running
  if (botProcess) {
    stopBot();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('start-bot', async () => {
  if (botProcess) {
    return { success: false, message: 'Bot is already running' };
  }

  try {
    const botPath = path.join(__dirname, '..', 'bot');
    const botScript = path.join(botPath, 'arbitrage-bot.js');

    // Check if bot script exists
    if (!fs.existsSync(botScript)) {
      return { success: false, message: 'Bot script not found' };
    }

    // Start bot process
    botProcess = spawn('node', [botScript], {
      cwd: botPath,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    botStatus = 'running';

    // Capture output
    let output = '';
    botProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot-output', data.toString());
      }
    });

    botProcess.stderr.on('data', (data) => {
      output += data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot-output', data.toString());
      }
    });

    botProcess.on('exit', (code) => {
      botProcess = null;
      botStatus = 'stopped';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot-status', 'stopped');
        mainWindow.webContents.send('bot-output', `\n[Bot stopped with code ${code}]\n`);
      }
    });

    return { success: true, message: 'Bot started successfully' };
  } catch (error) {
    botStatus = 'stopped';
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stop-bot', async () => {
  if (!botProcess) {
    return { success: false, message: 'Bot is not running' };
  }

  try {
    botProcess.kill();
    botProcess = null;
    botStatus = 'stopped';
    return { success: true, message: 'Bot stopped successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-bot-status', async () => {
  return { status: botStatus, running: botProcess !== null };
});

ipcMain.handle('get-contract-info', async () => {
  try {
    const botPath = path.join(__dirname, '..', 'bot');
    const envPath = path.join(botPath, '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const contractMatch = envContent.match(/CONTRACT_ADDRESS=(.+)/);
      const rpcMatch = envContent.match(/RPC_URL=(.+)/);
      
      return {
        contractAddress: contractMatch ? contractMatch[1].trim() : 'Not set',
        rpcUrl: rpcMatch ? rpcMatch[1].trim() : 'Not set',
      };
    }
    
    return { contractAddress: 'Not configured', rpcUrl: 'Not configured' };
  } catch (error) {
    return { contractAddress: 'Error', rpcUrl: 'Error' };
  }
});
