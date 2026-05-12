import { BrowserWindow, screen, app } from 'electron';
import path from 'node:path';
import log from 'electron-log';

const isDev = !app.isPackaged;

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'default',
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  return win;
}

export function createOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const win = new BrowserWindow({
    width: 140,
    height: 140,
    x: width - 160,
    y: 20,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  win.setVisibleOnAllWorkspaces(true);

  if (isDev) {
    win.loadURL('http://localhost:5173/?overlay=true');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  }

  log.info('[Overlay] Created overlay window');

  return win;
}
