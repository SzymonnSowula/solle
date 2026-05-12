export type OverlayState = 'idle' | 'listening' | 'working' | 'done' | 'error';

export interface FileInfo {
  name: string;
  isDirectory: boolean;
  size: number;
  ext: string;
}

export interface FileOperation {
  type: 'move' | 'createDir';
  from?: string;
  to: string;
  reason: string;
}

export interface FileOperationPlan {
  actions: FileOperation[];
  summary: string;
}

export type IpcChannel =
  | 'desktop:fs:listDirectory'
  | 'desktop:fs:getDesktopPath'
  | 'desktop:fs:executePlan'
  | 'desktop:fs:getFiles'
  | 'desktop:window:showOverlay'
  | 'desktop:window:hideOverlay'
  | 'desktop:window:setOverlayState'
  | 'desktop:window:showMain'
  | 'desktop:window:hideMain'
  | 'desktop:config:get'
  | 'desktop:globalShortcut:register'
  | 'desktop:globalShortcut:unregister'
  | 'desktop:autoStart:set'
  | 'desktop:autoStart:get'
  | 'desktop:app:quit';

export interface IpcApi {
  invoke: <T>(channel: IpcChannel, ...args: unknown[]) => Promise<T>;
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    electron: IpcApi;
  }
}
