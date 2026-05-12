import { app, globalShortcut, BrowserWindow } from 'electron';
import log from 'electron-log';
import { createMainWindow, createOverlayWindow } from './windows';
import { createTray, destroyTray } from './tray';
import { registerIpcHandlers } from './ipc';

// Disable GPU acceleration for WSL / headless environments
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

log.initialize();
log.info('[App] Starting Solli Desktop');

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log.warn('[App] Another instance is already running. Quitting.');
  app.quit();
}

app.on('second-instance', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  log.info('[App] Ready');

  registerIpcHandlers(getMainWindow, getOverlayWindow);

  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();

  createTray(getMainWindow, getOverlayWindow);

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    log.info('[Shortcut] Ctrl+Shift+S pressed');
    const win = getMainWindow();
    if (win) {
      if (win.isVisible()) {
        win.webContents.send('toggle-voice');
      } else {
        win.show();
        win.focus();
        setTimeout(() => {
          win.webContents.send('toggle-voice');
        }, 300);
      }
    }
  });

  // Show main window on first launch so user knows the app is running
  // (tray is also available for future launches)
  mainWindow.show();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyTray();
});

app.on('window-all-closed', () => {
  // Keep app running in background on Windows
  if (process.platform !== 'darwin') {
    // On Windows we keep tray alive; don't quit
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
