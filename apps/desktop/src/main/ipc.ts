import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { validatePath } from './safety';
import type { FileOperationPlan, FileInfo } from '@desktop/shared/types';
import log from 'electron-log';

const DESKTOP_PATH = path.join(os.homedir(), 'Desktop');

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  getOverlayWindow: () => BrowserWindow | null
) {
  ipcMain.handle('desktop:fs:getDesktopPath', async () => DESKTOP_PATH);

  ipcMain.handle('desktop:fs:getFiles', async (_event, dirPath?: string) => {
    const target = dirPath || DESKTOP_PATH;
    const validation = validatePath(target);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const entries = await fs.readdir(target, { withFileTypes: true });
    const files: FileInfo[] = entries.map((entry) => {
      const fullPath = path.join(target, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: stat.size,
        ext: path.extname(entry.name).toLowerCase(),
      };
    });

    return files;
  });

  ipcMain.handle('desktop:fs:listDirectory', async (_event, dirPath: string) => {
    const validation = validatePath(dirPath);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }));
  });

  ipcMain.handle('desktop:fs:executePlan', async (_event, plan: FileOperationPlan) => {
    const results: { success: boolean; action: string; error?: string }[] = [];

    for (const action of plan.actions) {
      try {
        if (action.type === 'createDir') {
          const validation = validatePath(action.to);
          if (!validation.valid) throw new Error(validation.reason);

          await fs.ensureDir(action.to);
          results.push({ success: true, action: `createDir ${action.to}` });
        } else if (action.type === 'move' && action.from) {
          const fromValidation = validatePath(action.from);
          const toValidation = validatePath(action.to);
          if (!fromValidation.valid) throw new Error(fromValidation.reason);
          if (!toValidation.valid) throw new Error(toValidation.reason);

          await fs.ensureDir(path.dirname(action.to));
          await fs.move(action.from, action.to, { overwrite: false });
          results.push({ success: true, action: `move ${path.basename(action.from)} -> ${action.to}` });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        log.error(`[IPC] executePlan failed for action:`, action, msg);
        results.push({ success: false, action: `${action.type} ${action.to}`, error: msg });
      }
    }

    return results;
  });

  ipcMain.handle('desktop:window:showMain', () => {
    const win = getMainWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  ipcMain.handle('desktop:window:hideMain', () => {
    const win = getMainWindow();
    if (win) win.hide();
  });

  ipcMain.handle('desktop:window:showOverlay', () => {
    const win = getOverlayWindow();
    if (win) {
      win.showInactive();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  ipcMain.handle('desktop:window:hideOverlay', () => {
    const win = getOverlayWindow();
    if (win) win.hide();
  });

  ipcMain.handle('desktop:window:setOverlayState', (_event, state: string) => {
    const win = getOverlayWindow();
    if (!win) return;

    win.webContents.send('overlay-state-changed', state);

    if (state === 'idle') {
      win.hide();
    } else {
      win.showInactive();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  ipcMain.handle('desktop:config:get', () => {
    return {
      apiBaseUrl: process.env.SOLLI_API_URL || 'http://localhost:3000',
    };
  });

  ipcMain.handle('desktop:autoStart:get', () => {
    const { app } = require('electron');
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('desktop:autoStart:set', (_event, openAtLogin: boolean) => {
    const { app } = require('electron');
    app.setLoginItemSettings({ openAtLogin });
  });

  ipcMain.handle('desktop:app:quit', () => {
    const { app } = require('electron');
    app.quit();
  });
}
