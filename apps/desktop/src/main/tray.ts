import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log';

let tray: Tray | null = null;

export function createTray(
  getMainWindow: () => BrowserWindow | null,
  getOverlayWindow: () => BrowserWindow | null
): Tray | null {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  let icon: Electron.NativeImage;

  try {
    if (fs.existsSync(iconPath) && fs.statSync(iconPath).size > 50) {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        log.warn('[Tray] Loaded icon is empty, using fallback');
        icon = nativeImage.createEmpty();
      }
    } else {
      log.warn('[Tray] Icon file missing or too small, using empty fallback');
      icon = nativeImage.createEmpty();
    }
  } catch (err) {
    log.error('[Tray] Failed to load icon:', err);
    icon = nativeImage.createEmpty();
  }

  try {
    tray = new Tray(icon);
  } catch (err) {
    log.error('[Tray] Failed to create tray, app will run without tray icon:', err);
    return null;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Solli',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    {
      label: 'Toggle Voice',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
          win.webContents.send('toggle-voice');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Start on Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Solli Desktop');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  log.info('[Tray] Tray created successfully');
  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
