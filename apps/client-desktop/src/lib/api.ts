const API_BASE = "http://localhost:8000";

export async function getOnboardingStatus() {
  const r = await fetch(`${API_BASE}/api/onboarding/status`);
  if (!r.ok) throw new Error("Failed to get onboarding status");
  return r.json();
}

export async function saveProfile(body: Record<string, any>) {
  const r = await fetch(`${API_BASE}/api/onboarding/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to save profile");
  return r.json();
}

export async function saveIntegrations(body: { integrations: any[] }) {
  const r = await fetch(`${API_BASE}/api/onboarding/integrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to save integrations");
  return r.json();
}

export async function completeOnboarding() {
  const r = await fetch(`${API_BASE}/api/onboarding/complete`, { method: "POST" });
  if (!r.ok) throw new Error("Failed to complete onboarding");
  return r.json();
}

export async function getProfile() {
  const r = await fetch(`${API_BASE}/api/settings/profile`);
  if (!r.ok) throw new Error("Failed to get profile");
  return r.json();
}

export async function getIntegrations() {
  const r = await fetch(`${API_BASE}/api/settings/integrations`);
  if (!r.ok) throw new Error("Failed to get integrations");
  return r.json();
}

export async function deleteIntegration(name: string) {
  const r = await fetch(`${API_BASE}/api/settings/integrations/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Failed to delete integration");
  return r.json();
}

export async function getKv(key: string) {
  const r = await fetch(`${API_BASE}/api/settings/kv/${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error("Failed to get setting");
  const data = await r.json();
  try {
    return JSON.parse(data.value);
  } catch {
    return data.value;
  }
}

export async function setKv(key: string, value: any) {
  const r = await fetch(`${API_BASE}/api/settings/kv/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
  if (!r.ok) throw new Error("Failed to save setting");
  return r.json();
}

export async function testSmtp(config: Record<string, any>) {
  const r = await fetch(`${API_BASE}/api/settings/smtp/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false, error: text || "Błąd połączenia" };
  }
  return r.json();
}

export async function stt(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  const r = await fetch(`${API_BASE}/api/voice/stt`, {
    method: "POST",
    body: formData,
  });
  if (!r.ok) throw new Error("STT failed");
  const data = await r.json();
  return data.text || "";
}

export async function tts(text: string): Promise<Blob> {
  const r = await fetch(`${API_BASE}/api/voice/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error("TTS failed");
  return r.blob();
}

export async function getNotifications(unread_only: boolean = false) {
  const r = await fetch(`${API_BASE}/api/notifications?unread_only=${unread_only}`);
  if (!r.ok) throw new Error("notifications fetch failed");
  return r.json();
}

export async function listActions(sessionId: string) {
  const r = await fetch(`${API_BASE}/api/actions/log?session_id=${sessionId}&limit=20`);
  if (!r.ok) throw new Error("Failed to list actions");
  return r.json();
}

export async function listUndoable(sessionId: string) {
  const r = await fetch(`${API_BASE}/api/actions/undoable?session_id=${sessionId}&limit=10`);
  if (!r.ok) throw new Error("Failed to list undoable actions");
  return r.json();
}

export async function undoAction(actionId: number) {
  const r = await fetch(`${API_BASE}/api/actions/undo/${actionId}`, { method: "POST" });
  if (!r.ok) throw new Error("Undo failed");
  return r.json();
}
