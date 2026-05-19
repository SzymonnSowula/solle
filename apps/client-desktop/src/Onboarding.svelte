<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getOnboardingStatus,
    saveProfile,
    saveIntegrations,
    completeOnboarding,
    getIntegrations,
  } from './lib/api';

  type Step = 'welcome' | 'profile' | 'workflow' | 'integrations' | 'test' | 'done';

  let step: Step = 'welcome';
  let loading = false;
  let error = '';

  // Profile fields
  let userName = 'Szef';
  let preferredTone = 'Bezpośredni, konkretny';

  // Workflow fields
  let tasks = 'emaile, pliki, research, kalendarz';
  let importantFolders = 'Pulpit, Dokumenty, Pobrane';

  // Integrations
  let integrations: Record<string, any> = {};

  function next() {
    const order: Step[] = ['welcome', 'profile', 'workflow', 'integrations', 'test', 'done'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) step = order[idx + 1];
  }

  async function saveProfileStep() {
    loading = true;
    error = '';
    try {
      await saveProfile({
        user_name: userName,
        preferred_tone: preferredTone,
      });
      next();
    } catch (e: any) {
      error = e.message || 'Błąd';
    } finally {
      loading = false;
    }
  }

  async function saveWorkflowStep() {
    loading = true;
    error = '';
    try {
      await saveProfile({
        tasks: tasks.split(',').map((s) => s.trim()).filter(Boolean),
        important_folders: importantFolders.split(',').map((s) => s.trim()).filter(Boolean),
      });
      next();
    } catch (e: any) {
      error = e.message || 'Błąd';
    } finally {
      loading = false;
    }
  }

  async function saveIntegrationStep() {
    loading = true;
    error = '';
    try {
      const list = Object.entries(integrations)
        .filter(([, v]) => v.active)
        .map(([name, v]) => ({ name, config: v.config || {}, active: true }));
      await saveIntegrations({ integrations: list });
      next();
    } catch (e: any) {
      error = e.message || 'Błąd';
    } finally {
      loading = false;
    }
  }

  async function finish() {
    loading = true;
    try {
      await completeOnboarding();
      window.dispatchEvent(new CustomEvent('onboarding-complete'));
    } catch (e: any) {
      error = e.message || 'Błąd';
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    try {
      const status = await getOnboardingStatus();
      if (status.complete) {
        window.dispatchEvent(new CustomEvent('onboarding-complete'));
      }
      const saved = await getIntegrations();
      for (const i of saved) {
        integrations[i.name] = { active: i.active, config: i.config };
      }
    } catch {}
  });
</script>

<div class="onboarding">
  {#if step === 'welcome'}
    <div class="step">
      <h1>Witaj w Volle</h1>
      <p>Jestem Twoim głosowym asystentem desktopowym. Pomogę Ci uporządkować pliki, pisać maile, szukać w internecie i zarządzać kalendarzem – wszystko głosem.</p>
      <p>Zacznijmy od krótkiej konfiguracji.</p>
      <button class="btn-primary" on:click={next}>Zaczynamy</button>
    </div>
  {:else if step === 'profile'}
    <div class="step">
      <h2>Twój profil</h2>
      <label>Imię / jak się do Ciebie zwracać</label>
      <input bind:value={userName} placeholder="np. Szef" />
      <label>Preferowany ton rozmowy</label>
      <input bind:value={preferredTone} placeholder="np. Bezpośredni, konkretny" />
      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={saveProfileStep} disabled={loading}>
        {loading ? 'Zapisuję...' : 'Dalej'}
      </button>
    </div>
  {:else if step === 'workflow'}
    <div class="step">
      <h2>Twój workflow</h2>
      <label>Jakie zadania wykonujesz najczęściej? (po przecinku)</label>
      <input bind:value={tasks} placeholder="emaile, pliki, research, kalendarz" />
      <label>Jakie foldery są najważniejsze? (po przecinku)</label>
      <input bind:value={importantFolders} placeholder="Pulpit, Dokumenty, Pobrane" />
      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={saveWorkflowStep} disabled={loading}>
        {loading ? 'Zapisuję...' : 'Dalej'}
      </button>
    </div>
  {:else if step === 'integrations'}
    <div class="step">
      <h2>Integracje</h2>
      <p>Podłącz usługi. Możesz dodać je teraz lub później w ustawieniach.</p>

      <!-- Email -->
      <div class="integration-card">
        <label class="integration-header">
          <input type="checkbox" bind:checked={integrations['email'].active} />
          <span>Email (SMTP)</span>
        </label>
        {#if integrations['email']?.active}
          <div class="integration-fields">
            <input placeholder="host" value={integrations['email']?.config?.host || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.host = e.currentTarget.value; }} />
            <input placeholder="port" value={integrations['email']?.config?.port || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.port = e.currentTarget.value; }} />
            <input placeholder="username" value={integrations['email']?.config?.username || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.username = e.currentTarget.value; }} />
            <input type="password" placeholder="password" value={integrations['email']?.config?.password || ''} on:input={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.password = e.currentTarget.value; }} />
            <label class="toggle-label">
              <input type="checkbox" checked={integrations['email']?.config?.tls !== false} on:change={(e) => { integrations['email'] = integrations['email'] || { active: true, config: {} }; integrations['email'].config.tls = e.currentTarget.checked; }} />
              Użyj TLS
            </label>
          </div>
        {/if}
      </div>

      <!-- Calendar -->
      <div class="integration-card">
        <label class="integration-header">
          <input type="checkbox" bind:checked={integrations['calendar'].active} />
          <span>Kalendarz</span>
        </label>
      </div>

      <!-- Web Research -->
      <div class="integration-card">
        <label class="integration-header">
          <input type="checkbox" bind:checked={integrations['web_research'].active} />
          <span>Web Research</span>
        </label>
      </div>

      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={saveIntegrationStep} disabled={loading}>
        {loading ? 'Zapisuję...' : 'Dalej'}
      </button>
    </div>
  {:else if step === 'test'}
    <div class="step">
      <h2>Test</h2>
      <p>Sprawdźmy czy wszystko działa. Możesz zadać pierwsze polecenie.</p>
      <p class="hint">np. „Uporządkuj mój pulpit” lub „Napisz email do Jana”</p>
      <button class="btn-primary" on:click={next}>Przejdź do aplikacji</button>
    </div>
  {:else if step === 'done'}
    <div class="step">
      <h2>Gotowe!</h2>
      <p>Volle jest skonfigurowana. Od teraz możesz sterować komputerem głosem lub tekstem.</p>
      <button class="btn-primary" on:click={finish} disabled={loading}>
        {loading ? 'Uruchamiam...' : 'Start'}
      </button>
    </div>
  {/if}
</div>

<style>
  .onboarding {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .step {
    max-width: 420px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1, h2 {
    margin: 0;
    font-size: 22px;
    color: #e0f2fe;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: rgba(255,255,255,0.75);
  }
  label {
    font-size: 12px;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 4px;
  }
  input {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 10px 12px;
    color: #f0f0f5;
    font-size: 14px;
    outline: none;
  }
  input:focus {
    border-color: rgba(14, 165, 233, 0.6);
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
    transition: opacity 0.2s;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .error {
    color: #fca5a5;
    font-size: 13px;
  }
  .integration-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .integration-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #f0f0f5;
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  .integration-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  .hint {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    font-style: italic;
  }
</style>
