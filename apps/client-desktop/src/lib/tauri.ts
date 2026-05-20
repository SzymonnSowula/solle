import { invoke } from "@tauri-apps/api/core";

export async function tauriOpenFolder(path: string): Promise<void> {
  await invoke("open_folder", { path });
}

export async function tauriOpenApp(name: string): Promise<void> {
  await invoke("open_app", { name });
}

export async function tauriClipboardWrite(text: string): Promise<void> {
  await invoke("clipboard_write", { text });
}

export async function tauriClipboardRead(): Promise<string> {
  return await invoke("clipboard_read") as string;
}

export async function startVoicePipeline(): Promise<void> {
  await invoke("start_voice_pipeline");
}

export async function stopVoicePipeline(): Promise<void> {
  await invoke("stop_voice_pipeline");
}
