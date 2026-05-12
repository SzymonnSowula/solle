import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi, IpcChannel } from '@desktop/shared/types';

const api: IpcApi = {
  invoke: <T>(channel: IpcChannel, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args) as Promise<T>,
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, (_event, ...args) => callback(...args));
  },
};

contextBridge.exposeInMainWorld('electron', api);
