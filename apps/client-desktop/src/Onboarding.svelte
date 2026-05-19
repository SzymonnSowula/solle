<script lang="ts">
  import { onMount } from 'svelte';
  import { getOnboardingStatus, saveProfile, saveIntegrations, completeOnboarding, getIntegrations } from './lib/api';

  type Step = 'welcome' | 'profile' | 'workflow' | 'integrations' | 'test' | 'done';

  let step: Step = 'welcome';
  let loading = false;
  let error = '';

  let userName = 'Szef';
  let preferredTone = 'neutralny';
  let tasks = 'emaile, pliki, research, kalendarz';
  let importantFolders = 'Pulpit, Dokumenty, Pobrane';
  let integrations: Record<string, any> = {};

  const tones = ['formalny', 'neutralny', 'luźny'];

  function next() {
    const order: Step[] = ['welcome', 'profile', 'workflow', 'integrations', 'test', 'done'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) step = order[idx + 1];
  }

  async function saveProfileStep() {
    loading = true; error = '';
    try { await saveProfile({ user_name: userName, preferred_tone: preferredTone }); next(); }
    catch (e: any) { error = e.message || 'Błąd'; }
    finally { loading = false; }
  }

  async function saveWorkflowStep() {
    loading = true; error = '';
    try {
      await saveProfile({ tasks: tasks.split(',').map((s) => s.trim()).filter(Boolean), important_folders: importantFolders.split(',').map((s) => s.trim()).filter(Boolean) });
      next();
    } catch (e: any) { error = e.message || 'Błąd'; }
    finally { loading = false; }
  }

  async function saveIntegrationStep() {
    loading = true; error = '';
    try {
      const list = Object.entries(integrations).filter(([, v]) => v.active).map(([name, v]) => ({ name, config: v.config || {}, active: true }));
      await saveIntegrations({ integrations: list }); next();
    } catch (e: any) { error = e.message || 'Błąd'; }
    finally { loading = false; }
  }

  async function finish() {
    loading = true;
    try { await completeOnboarding(); window.dispatchEvent(new CustomEvent('onboarding-complete')); }
    catch (e: any) { error = e.message || 'Błąd'; }
    finally { loading = false; }
  }

  onMount(async () => {
    try {
      const status = await getOnboardingStatus();
      if (status.complete) window.dispatchEvent(new CustomEvent('onboarding-complete'));
      const saved = await getIntegrations();
      for (const i of saved) { integrations[i.name] = { active: i.active, config: i.config }; }
    } catch {}
  });
</script>

<div class="onboarding">
  <!-- Progress dots -->
  <div class="progress">
    {#each ['welcome', 'profile', 'workflow', 'integrations', 'test', 'done'] as s, i}
      <div class="dot" class:active={s === step} class:done={['welcome','profile','workflow','integrations','test','done'].indexOf(step) > i}></div>
    {/each}
  </div>

  {#if step === 'welcome'}
    <div class="step" transition:fade={{ duration: 250 }}>
      <div class="orb-welcome">🎙️</div>
      <h1>Witaj w Volle</h1>
      <p>Twój głosowy asystent desktopowy. Pomogę uporządkować pliki, pisać maile, szukać w internecie i zarządzać kalendarzem — wszystko głosem.</p>
      <button class="btn-primary" on:click={next}>Zaczynamy</button>
    </div>

  {:else if step === 'profile'}
    <div class="step" transition:fade={{ duration: 250 }}>
      <h2>Twój profil</h2>
      <div class="field">
        <label for="onb-name">Imię / jak się do Ciebie zwracać</label>
        <input id="onb-name" class="fluent-input" bind:value={userName} placeholder="np. Szef" />
      </div>
      <div class="field">
        <label>Ton rozmowy</label>
        <div class="segment">
          {#each tones as tone}
            <button class="seg-btn" class:active={preferredTone === tone} on:click={() => preferredTone = tone}>{tone}</button>
          {/each}
        </div>
      </div>
      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={saveProfileStep} disabled={loading}>{loading ? 'Zapisuję...' : 'Dalej'}</button>
    </div>

  {:else if step === 'workflow'}
    <div class="step" transition:fade={{ duration: 250 }}>
      <h2>Twój workflow</h2>
      <div class="field">
        <label for="onb-tasks">Zadania najczęściej wykonywane (po przecinku)</label>
        <input id="onb-tasks" class="fluent-input" bind:value={tasks} placeholder="emaile, pliki, research, kalendarz" />
      </div>
      <div class="field">
        <label for="onb-folders">Ważne foldery (po przecinku)</label>
        <input id="onb-folders" class="fluent-input" bind:value={importantFolders} placeholder="Pulpit, Dokumenty, Pobrane" />
      </div>
      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={saveWorkflowStep} disabled={loading}>{loading ? 'Zapisuję...' : 'Dalej'}</button>
    </div>

  {:else if step === 'integrations'}
    <div class="step" transition:fade={{ duration: 250 }}>
      <h2>Integracje</h2>
      <p class="subtitle">Podłącz usługi teraz lub później w ustawieniach.</p>

      <div class="integration-card">
        <div class="int-header">
          <button class="toggle-switch" class:on={integrations['email']?.active} on:click={() => { integrations['email'] = integrations['email'] || { active: false, config: {} }; integrations['email'].active = !integrations['email'].active; }} aria-label="Toggle email">
            <span class="toggle-knob"></span>
          </button>
          <span class="int-name">Email (SMTP)</span>
        </div>
        {#if integrations['email']?.active}
          <div class="int-fields">
            <input class="fluent-input" placeholder="host" value={integrations['email']?.config?.host || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.host = e.currentTarget.value; }} />
            <div class="field-row">
              <input class="fluent-input half" placeholder="port" value={integrations['email']?.config?.port || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.port = e.currentTarget.value; }} />
              <button class="toggle-switch small" class:on={integrations['email']?.config?.tls !== false} on:click={() => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.tls = integrations['email'].config?.tls !== false ? false : true; }} aria-label="Toggle TLS">
                <span class="toggle-knob"></span>
              </button>
              <span class="toggle-label-inline">TLS</span>
            </div>
            <input class="fluent-input" placeholder="username" value={integrations['email']?.config?.username || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.username = e.currentTarget.value; }} />
            <input class="fluent-input" type="password" placeholder="password" value={integrations['email']?.config?.password || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.password = e.currentTarget.value; }} />
          </div>
        {/if}
      </div>

      <div class="integration-card">
        <div class="int-header">
          <button class="toggle-switch" class:on={integrations['calendar']?.active} on:click={() => { integrations['calendar'] = integrations['calendar'] || { active: false, config: {} }; integrations['calendar'].active = !integrations['calendar'].active; }} aria-label="Toggle calendar">
            <span class="toggle-knob"></span>
          </button>
          <span class="int-name">Kalendarz</span>
        </div>
      </div>

      <div class="integration-card">
        <div class="int-header">
          <button class="toggle-switch" class:on={integrations['web_research']?.active} on:click={() => { integrations['web_research'] = integrations['web_research'] || { active: false, config: {} }; integrations['web_research'].active = !integrations['web_research'].active; }} aria-label="Toggle web research">
            <span class="toggle-knob"></span>
          </button>
          <span class="int-name">Web Research</span>
        </div>
      </div>

      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={saveIntegrationStep} disabled={loading}>{loading ? 'Zapisuję...' : 'Dalej'}</button>
    </div>

  {:else if step === 'test'}
    <div class="step" transition:fade={{ duration: 250 }}>
      <h2>Test</h2>
      <p>Sprawdźmy czy wszystko działa. Możesz zadać pierwsze polecenie.</p>
      <p class="hint">np. „Uporządkuj mój pulpit” lub „Napisz email do Jana”</p>
      <button class="btn-primary" on:click={next}>Przejdź do aplikacji</button>
    </div>

  {:else if step === 'done'}
    <div class="step" transition:fade={{ duration: 250 }}>
      <div class="orb-welcome">🎉</div>
      <h2>Gotowe!</h2>
      <p>Volle jest skonfigurowana. Od teraz sterujesz komputerem głosem lub tekstem.</p>
      <button class="btn-primary" on:click={finish} disabled={loading}>{loading ? 'Uruchamiam...' : 'Start'}</button>
    </div>
  {/if}
</div>

<script context="module">
  function fade(node: HTMLElement, { duration = 250 }) {
    return { duration, css: (t: number) => `opacity: ${t}; transform: translateY(${(1-t)*10}px);` };
  }
</script>

<style>
  .onboarding {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 24px 24px;
    box-sizing: border-box;
    overflow-y: auto;
    gap: 18px;
  }

  .progress {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }
  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--surface-hover);
    transition: background var(--dur-normal), transform var(--dur-normal);
  }
  .dot.active { background: var(--accent); transform: scale(1.4); box-shadow: 0 0 6px var(--accent-glow); }
  .dot.done { background: var(--accent); opacity: 0.5; }

  .step {
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }

  .orb-welcome {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #7c3aed);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
    box-shadow: 0 8px 24px rgba(59,130,246,0.3);
    margin-bottom: 4px;
  }

  h1, h2 { margin: 0; font: var(--font-title); color: var(--text-primary); letter-spacing: -0.01em; text-align: center; }
  p { margin: 0; font: var(--font-body); color: var(--text-secondary); line-height: 1.55; text-align: center; }
  .subtitle { font: var(--font-caption); color: var(--text-tertiary); margin-top: -6px; }
  .hint { font: var(--font-caption); color: var(--text-disabled); font-style: italic; }

  .field { width: 100%; display: flex; flex-direction: column; gap: 6px; }
  .field label { font: var(--font-caption); color: var(--text-tertiary); letter-spacing: 0.02em; }

  .fluent-input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 9px 12px;
    color: var(--text-primary);
    font: var(--font-body);
    font-size: 13px;
    outline: none;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
    transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
    box-sizing: border-box;
  }
  .fluent-input::placeholder { color: var(--text-disabled); }
  .fluent-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(96,205,255,0.10), inset 0 1px 2px rgba(0,0,0,0.06); }
  .field-row { display: flex; gap: 10px; align-items: center; }
  .fluent-input.half { flex: 1; }

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
  .seg-btn.active { background: rgba(255,255,255,0.09); color: var(--text-primary); font-weight: 600; }
  .seg-btn:hover:not(.active) { background: var(--surface-hover); }

  .btn-primary {
    width: 100%;
    background: linear-gradient(135deg, var(--accent-secondary), #004e8c);
    border: none;
    border-radius: var(--radius-lg);
    padding: 11px 22px;
    color: #fff;
    font: var(--font-body-strong);
    font-size: 14px;
    cursor: pointer;
    margin-top: 4px;
    box-shadow: 0 4px 14px rgba(0,95,184,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
    transition: transform var(--dur-fast), box-shadow var(--dur-fast);
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,95,184,0.45); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .error {
    color: var(--danger);
    font: var(--font-caption);
    background: rgba(255,153,164,0.06);
    border: 1px solid rgba(255,153,164,0.12);
    border-radius: var(--radius-md);
    padding: 6px 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .integration-card {
    width: 100%;
    background: var(--surface-card);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-lg);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-sizing: border-box;
  }
  .int-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .int-name { font: var(--font-body); font-size: 13px; color: var(--text-secondary); }
  .int-fields { display: flex; flex-direction: column; gap: 8px; }

  /* Toggle switch */
  .toggle-switch {
    width: 40px; height: 20px;
    border-radius: 10px;
    background: rgba(255,255,255,0.12);
    border: none;
    position: relative;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
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
  .toggle-switch.small { width: 32px; height: 16px; }
  .toggle-switch.small .toggle-knob { width: 12px; height: 12px; top: 2px; left: 2px; }
  .toggle-switch.small.on .toggle-knob { transform: translateX(16px); }
  .toggle-label-inline { font: var(--font-caption); color: var(--text-tertiary); }
</style>
