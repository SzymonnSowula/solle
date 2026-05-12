import { useCallback } from 'react';
import type { IpcChannel } from '@desktop/shared/types';

export function useElectron() {
  const ipcInvoke = useCallback(<T,>(channel: IpcChannel, ...args: unknown[]): Promise<T> => {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    return window.electron.invoke<T>(channel, ...args);
  }, []);

  const ipcOn = useCallback((channel: string, callback: (...args: unknown[]) => void) => {
    if (!window.electron) return;
    window.electron.on(channel, callback);
  }, []);

  const ipcOff = useCallback((channel: string, callback: (...args: unknown[]) => void) => {
    if (!window.electron) return;
    window.electron.off(channel, callback);
  }, []);

  return { ipcInvoke, ipcOn, ipcOff };
}
