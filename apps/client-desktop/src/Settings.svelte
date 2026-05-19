<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getProfile,
    saveProfile,
    getKv,
    setKv,
    testSmtp,
    getLlmProvider,
    setLlmProvider,
    getLocalLlmStatus,
  } from './lib/api';

  let profile: any = {};
  let tasks = '';
  let importantFolders = '';
  let smtp: any = { host: '', port: '587', username: '', password: '', tls: true };
  let loading = false;
  let saved = false;
  let smtpTestMsg = '';

  // Local LLM state
  let llmProvider = 'openai';
  let localModel = 'llama3';
  let localUrl = 'http://localhost:11434/v1';
  let localStatus: any = null;
  let checkingLocal = false;

  onMount(async () => {
    try {
      profile = await getProfile();
      const t = await getKv('tasks');
      tasks = Array.isArray(t) ? t.join(', ') : (t || '');
      const f = await getKv('important_folders');
      importantFolders = Array.isArray(f) ? f.join(', ') : (f || '');
      const s = await getKv('smtp_config');
      if (s && typeof s === 'object') {
        smtp = { ...smtp, ...s };
      }
      const lp = await getLlmProvider();
      llmProvider = lp.provider || 'openai';
      localModel = lp.local_model || 'llama3';
      localUrl = lp.local_url || 'http://localhost:11434/v1';
      checkLocalStatus();
    } catch {}
  });

  async function checkLocalStatus() {
    checkingLocal = true;
    try {
      localStatus = await getLocalLlmStatus();
    } catch (e) {
      localStatus = { available: false };
    } finally {
      checkingLocal = false;
    }
  }

  async function save() {
    loading = true;
    try {
      await saveProfile({
        user_name: profile.user_name,
        preferred_tone: profile.preferred_tone,
      });
      await setKv('tasks', tasks.split(',').map((s: string) => s.trim()).filter(Boolean));
      await setKv('important_folders', importantFolders.split(',').map((s: string) => s.trim()).filter(Boolean));
      await setKv('smtp_config', smtp);
      await setLlmProvider({ provider: llmProvider, local_model: localModel, local_url: localUrl });
      saved = true;
      setTimeout(() => saved = false, 2000);
    } finally {
      loading = false;
    }
  }

  async function handleTestSmtp() {
    smtpTestMsg = '';
    try {
      const res = await testSmtp(smtp);
      smtpTestMsg = res.ok ? 'Połączenie OK' : (res.error || 'Błąd połączenia');
    } catch (e: any) {
      smtpTestMsg = e.message || 'Błąd połączenia';
    }
  }
</script>

<div class="settings">
  <h2>Ustawienia</h2>

  <h3>Profil</h3>
  <label>Imię / zwracanie</label>
  <input bind:value={profile.user_name} />
  <label>Ton rozmowy</label>
  <input bind:value={profile.preferred_tone} />
  <label>Zadania najczęściej wykonywane (po przecinku)</label>
  <input bind:value={tasks} placeholder="emaile, pliki, research, kalendarz" />
  <label>Ważne foldery (po przecinku)</label>
  <input bind:value={importantFolders} placeholder="Pulpit, Dokumenty, Pobrane" />

  <h3>Email SMTP</h3>
  <label>Host</label>
  <input bind:value={smtp.host} placeholder="smtp.gmail.com" />
  <label>Port</label>
  <input bind:value={smtp.port} placeholder="587" />
  <label>Użytkownik</label>
  <input bind:value={smtp.username} placeholder="adres@email.com" />
  <label>Hasło / token aplikacji</label>
  <input type="password" bind:value={smtp.password} />
  <label class="toggle-label">
    <input type="checkbox" bind:checked={smtp.tls} />
    Użyj TLS
  </label>
  <button class="btn-small" on:click={handleTestSmtp} disabled={!smtp.host || !smtp.username}>
    Test połączenia
  </button>
  {#if smtpTestMsg}<div class="test-msg">{smtpTestMsg}</div>{/if}

  <h3>LLM / Model AI</h3>
  <label class="toggle-label">
    <input type="checkbox" checked={llmProvider === 'local'} on:change={(e) => { llmProvider = (e.target as HTMLInputElement).checked ? 'local' : 'openai'; }} />
    Użyj lokalnego LLM (Ollama/lm-studio)
  </label>
  {#if llmProvider === 'local'}
    <label>URL serwera lokalnego</label>
    <input bind:value={localUrl} placeholder="http://localhost:11434/v1" />
    <label>Model</label>
    <input bind:value={localModel} placeholder="llama3" />
    <button class="btn-small" on:click={checkLocalStatus} disabled={checkingLocal}>
      {checkingLocal ? 'Sprawdzam...' : 'Sprawdź dostępność'}
    </button>
    {#if localStatus}
      <div class="test-msg">
        {#if localStatus.available}
          Dostępny — {localStatus.models?.length || 0} modeli
        {:else}
          Brak połączenia — {localStatus.error || 'nie odpowiada'}
        {/if}
      </div>
    {/if}
  {/if}

  {#if saved}<div class="saved">Zapisano!</div>{/if}
  <button class="btn-primary" on:click={save} disabled={loading}>
    {loading ? 'Zapisuję...' : 'Zapisz zmiany'}
  </button>
</div>

<style>
  .settings {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 28px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 { margin: 0; font-size: 20px; color: #e0f2fe; }
  h3 { margin: 16px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.55); }
  label { font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
  input {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 10px 12px;
    color: #f0f0f5;
    font-size: 14px;
    outline: none;
  }
  input:focus { border-color: rgba(14, 165, 233, 0.6); }
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
    margin-top: 4px;
  }
  .btn-small {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.7);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    align-self: flex-start;
  }
  .btn-primary {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    border: none;
    color: #fff;
    padding: 12px 24px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 8px;
  }
  .saved { color: #86efac; font-size: 13px; }
  .test-msg { font-size: 13px; color: #86efac; }
</style>
