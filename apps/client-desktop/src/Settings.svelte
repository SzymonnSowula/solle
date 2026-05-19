<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getProfile, saveProfile, getKv, setKv, testSmtp,
    getLlmProvider, setLlmProvider, getLocalLlmStatus,
  } from './lib/api';

  let profile: any = {};
  let tasks = '';
  let importantFolders = '';
  let smtp: any = { host: '', port: '587', username: '', password: '', tls: true };
  let loading = false;
  let saved = false;
  let smtpTestMsg = '';

  // Local LLM
  let llmProvider = 'openai';
  let localModel = 'llama3';
  let localUrl = 'http://localhost:11434/v1';
  let localStatus: any = null;
  let checkingLocal = false;

  // ElevenLabs
  let elKey = '';
  let elVoice = '21m00Tcm4TlvDq8ikWAM';

  onMount(async () => {
    try {
      profile = await getProfile();
      const t = await getKv('tasks');
      tasks = Array.isArray(t) ? t.join(', ') : (t || '');
      const f = await getKv('important_folders');
      importantFolders = Array.isArray(f) ? f.join(', ') : (f || '');
      const s = await getKv('smtp_config');
      if (s && typeof s === 'object') smtp = { ...smtp, ...s };
      const lp = await getLlmProvider();
      llmProvider = lp.provider || 'openai';
      localModel = lp.local_model || 'llama3';
      localUrl = lp.local_url || 'http://localhost:11434/v1';
      checkLocalStatus();
    } catch {}
  });

  async function checkLocalStatus() {
    checkingLocal = true;
    try { localStatus = await getLocalLlmStatus(); }
    catch (e) { localStatus = { available: false }; }
    finally { checkingLocal = false; }
  }

  async function save() {
    loading = true;
    try {
      await saveProfile({ user_name: profile.user_name, preferred_tone: profile.preferred_tone });
      await setKv('tasks', tasks.split(',').map((s: string) => s.trim()).filter(Boolean));
      await setKv('important_folders', importantFolders.split(',').map((s: string) => s.trim()).filter(Boolean));
      await setKv('smtp_config', smtp);
      await setLlmProvider({ provider: llmProvider, local_model: localModel, local_url: localUrl });
      saved = true;
      setTimeout(() => saved = false, 2500);
    } finally { loading = false; }
  }

  async function handleTestSmtp() {
    smtpTestMsg = '';
    try {
      const res = await testSmtp(smtp);
      smtpTestMsg = res.ok ? 'Połączenie OK' : (res.error || 'Błąd połączenia');
    } catch (e: any) { smtpTestMsg = e.message || 'Błąd połączenia'; }
  }
</script>

<div class="settings">
  <header class="settings-header">
    <h2>Ustawienia</h2>
    <p class="subtitle">Spersonalizuj Volle pod siebie</p>
  </header>

  <!-- Profile -->
  <section class="card">
    <div class="card-head">
      <span class="card-icon">👤</span>
      <span class="card-title">Profil</span>
    </div>
    <div class="field">
      <label>Imię / zwracanie</label>
      <input class="fluent-input" bind:value={profile.user_name} placeholder="Twoje imię" />
    </div>
    <div class="field">
      <label>Ton rozmowy</label>
      <div class="segment">
        {#each ['formalny', 'neutralny', 'luźny'] as tone}
          <button class="seg-btn" class:active={profile.preferred_tone === tone} on:click={() => profile.preferred_tone = tone}>{tone}</button>
        {/each}
      </div>
    </div>
    <div class="field">
      <label>Zadania najczęściej wykonywane (po przecinku)</label>
      <input class="fluent-input" bind:value={tasks} placeholder="emaile, pliki, research, kalendarz" />
    </div>
    <div class="field">
      <label>Ważne foldery (po przecinku)</label>
      <input class="fluent-input" bind:value={importantFolders} placeholder="Pulpit, Dokumenty, Pobrane" />
    </div>
  </section>

  <!-- Email -->
  <section class="card">
    <div class="card-head">
      <span class="card-icon">✉️</span>
      <span class="card-title">Email SMTP</span>
    </div>
    <div class="field-row">
      <div class="field half">
        <label>Host</label>
        <input class="fluent-input" bind:value={smtp.host} placeholder="smtp.gmail.com" />
      </div>
      <div class="field half">
        <label>Port</label>
        <input class="fluent-input" bind:value={smtp.port} placeholder="587" />
      </div>
    </div>
    <div class="field">
      <label>Użytkownik</label>
      <input class="fluent-input" bind:value={smtp.username} placeholder="adres@email.com" />
    </div>
    <div class="field">
      <label>Hasło / token aplikacji</label>
      <input class="fluent-input" type="password" bind:value={smtp.password} />
    </div>
    <div class="field inline">
      <span class="toggle-label">Użyj TLS</span>
      <button class="toggle-switch" class:on={smtp.tls} on:click={() => smtp.tls = !smtp.tls} aria-label="Toggle TLS">
        <span class="toggle-knob"></span>
      </button>
    </div>
    <div class="field actions">
      <button class="btn-secondary" on:click={handleTestSmtp} disabled={!smtp.host || !smtp.username}>
        Test połączenia
      </button>
      {#if smtpTestMsg}<span class="test-msg" class:error={!smtpTestMsg.includes('OK')}>{smtpTestMsg}</span>{/if}
    </div>
  </section>

  <!-- AI Model -->
  <section class="card">
    <div class="card-head">
      <span class="card-icon">🧠</span>
      <span class="card-title">Model AI</span>
    </div>
    <div class="field inline">
      <span class="toggle-label">Lokalny LLM (Ollama / LM Studio)</span>
      <button class="toggle-switch" class:on={llmProvider === 'local'} on:click={() => llmProvider = llmProvider === 'local' ? 'openai' : 'local'} aria-label="Toggle local LLM">
        <span class="toggle-knob"></span>
      </button>
    </div>
    {#if llmProvider === 'local'}
      <div class="field">
        <label>URL serwera</label>
        <input class="fluent-input" bind:value={localUrl} placeholder="http://localhost:11434/v1" />
      </div>
      <div class="field">
        <label>Model</label>
        <input class="fluent-input" bind:value={localModel} placeholder="llama3" />
      </div>
      <div class="field actions">
        <button class="btn-secondary" on:click={checkLocalStatus} disabled={checkingLocal}>
          {checkingLocal ? 'Sprawdzam...' : 'Sprawdź dostępność'}
        </button>
        {#if localStatus}
          <span class="test-msg" class:error={!localStatus.available}>
            {#if localStatus.available}Dostępny — {localStatus.models?.length || 0} modeli{:else}Brak połączenia{/if}
          </span>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Voice -->
  <section class="card">
    <div class="card-head">
      <span class="card-icon">🔊</span>
      <span class="card-title">Głos ElevenLabs</span>
    </div>
    <div class="field">
      <label>Voice ID</label>
      <input class="fluent-input" bind:value={elVoice} placeholder="21m00Tcm4TlvDq8ikWAM" />
    </div>
    <div class="hint">Znajdziesz w panelu ElevenLabs → Voices</div>
  </section>

  <!-- Save -->
  <div class="save-bar">
    {#if saved}
      <div class="toast" transition:fade={{ duration: 200 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        <span>Zapisano</span>
      </div>
    {/if}
    <button class="btn-primary" on:click={save} disabled={loading}>
      {loading ? 'Zapisuję...' : 'Zapisz zmiany'}
    </button>
  </div>
</div>

<script context="module">
  function fade(node: HTMLElement, { duration = 200 }) {
    return { duration, css: (t: number) => `opacity: ${t}; transform: translateY(${(1-t)*4}px);` };
  }
</script>

<style>
  .settings {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 24px 22px 80px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .settings-header { margin-bottom: 4px; }
  .settings-header h2 {
    margin: 0;
    font: var(--font-title);
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .subtitle {
    margin: 4px 0 0;
    font: var(--font-caption);
    color: var(--text-tertiary);
  }

  /* Card sections */
  .card {
    background: var(--surface-card);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-xl);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    backdrop-filter: blur(8px);
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }
  .card-icon { font-size: 16px; filter: saturate(0.8); }
  .card-title {
    font: var(--font-body-strong);
    font-size: 13px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Fields */
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label, .toggle-label {
    font: var(--font-caption);
    color: var(--text-tertiary);
    letter-spacing: 0.02em;
  }
  .field.inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .field-row { display: flex; gap: 10px; }
  .field.half { flex: 1; }
  .field.actions {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .hint {
    font: var(--font-caption);
    color: var(--text-disabled);
    margin-top: -6px;
  }

  /* Fluent inputs */
  .fluent-input {
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 8px 12px;
    color: var(--text-primary);
    font: var(--font-body);
    font-size: 13px;
    outline: none;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.12);
    transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
  }
  .fluent-input::placeholder { color: var(--text-disabled); }
  .fluent-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(96,205,255,0.10), inset 0 1px 2px rgba(0,0,0,0.08);
  }

  /* Segmented control */
  .segment {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 3px;
    gap: 2px;
  }
  .seg-btn {
    flex: 1;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    color: var(--text-secondary);
    font: var(--font-caption);
    cursor: pointer;
    transition: background var(--dur-fast), color var(--dur-fast);
  }
  .seg-btn.active {
    background: rgba(255,255,255,0.09);
    color: var(--text-primary);
    font-weight: 600;
  }
  .seg-btn:hover:not(.active) { background: var(--surface-hover); }

  /* Toggle switch */
  .toggle-switch {
    width: 40px; height: 20px;
    border-radius: 10px;
    background: rgba(255,255,255,0.12);
    border: none;
    position: relative;
    cursor: pointer;
    padding: 0;
    transition: background var(--dur-fast);
  }
  .toggle-switch.on { background: var(--accent-secondary); }
  .toggle-knob {
    position: absolute;
    top: 2px; left: 2px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    transition: transform var(--dur-fast) var(--ease-spring);
  }
  .toggle-switch.on .toggle-knob { transform: translateX(20px); }

  /* Buttons */
  .btn-secondary {
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 6px 14px;
    color: var(--text-secondary);
    font: var(--font-caption);
    cursor: pointer;
    transition: background var(--dur-fast), border-color var(--dur-fast);
  }
  .btn-secondary:hover { background: var(--surface-hover); border-color: var(--mica-border-active); }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary {
    background: linear-gradient(135deg, var(--accent-secondary), #004e8c);
    border: none;
    border-radius: var(--radius-lg);
    padding: 10px 22px;
    color: #fff;
    font: var(--font-body-strong);
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,95,184,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
    transition: transform var(--dur-fast), box-shadow var(--dur-fast);
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,95,184,0.45); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .test-msg {
    font: var(--font-caption);
    color: var(--success);
  }
  .test-msg.error { color: var(--danger); }

  /* Save bar */
  .save-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
    background: linear-gradient(to top, rgba(24,24,32,0.98) 60%, transparent);
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--font-caption);
    color: var(--success);
    background: rgba(108,203,95,0.08);
    border: 1px solid rgba(108,203,95,0.15);
    border-radius: var(--radius-md);
    padding: 5px 10px;
  }
</style>
