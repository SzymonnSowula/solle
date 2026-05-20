<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import Onboarding from './Onboarding.svelte';
  import Settings from './Settings.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ActionLog from './ActionLog.svelte';
  import { getOnboardingStatus, stt, tts, getNotifications } from './lib/api';
  import { tauriOpenFolder, tauriOpenApp, startVoicePipeline, stopVoicePipeline } from './lib/tauri';

  type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
  type View = 'widget' | 'onboarding' | 'settings';
  type Mode = 'general' | 'business' | 'desktop';

  let view: View = 'onboarding';
  let status: Status = 'idle';
  let message = 'Volle gotowa. Wciśnij Spację i mów.';
  let card: any = null;
  let ws: WebSocket | null = null;
  let connected = false;
  let inputText = '';
  let showInput = false;
  let interimText = '';
  let inputRef: HTMLInputElement | null = null;
  let sessionId: string | null = null;
  let mode: Mode = 'general';
  let modeMenuOpen = false;

  // MediaRecorder / audio playback state
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  let maxRecTimeout: ReturnType<typeof setTimeout> | null = null;
  let spaceHeld = false;
  let currentAudio: HTMLAudioElement | null = null;
  let confirmMsg = '';
  let pendingAction: any = null;
  let showActionLog = false;

  // STT streaming
  let sttWs: WebSocket | null = null;
  let sttConnected = false;

  // Notifications
  let notifications: any[] = [];
  let notifInterval: ReturnType<typeof setInterval> | null = null;
  let lastNotifCount = 0;

  // Waveform canvas
  let canvasRef: HTMLCanvasElement | null = null;
  let animFrame: number | null = null;
  let wavePhase = 0;

  onMount(() => {
    checkOnboarding();
    connect();
    startNotificationPolling();
    startWaveform();
    startVoicePipeline().catch(() => {});

    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        toggleListening();
        return;
      }
      if (e.code === 'Space' && !e.ctrlKey && !e.shiftKey && !e.metaKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && view === 'widget') {
        e.preventDefault();
        if (!spaceHeld) { spaceHeld = true; startRecording(); }
        return;
      }
      if (e.key === 'Escape') { cancelAll(); }
    };
    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceHeld) { spaceHeld = false; stopRecording(); }
    };

    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);
    window.addEventListener('onboarding-complete', () => { view = 'widget'; });

    let unlistenWake: (() => void) | null = null;
    let unlistenEnd: (() => void) | null = null;

    listen('wake-word-detected', () => {
      status = 'listening';
      message = 'Słucham...';
      interimText = '';
      card = null;
    }).then((fn) => { unlistenWake = fn; });

    listen('speech-ended', () => {
      status = 'idle';
      message = 'Volle gotowa. Wciśnij Spację i mów.';
    }).then((fn) => { unlistenEnd = fn; });

    return () => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
      cleanupRecording();
      stopNotificationPolling();
      stopVoicePipeline().catch(() => {});
      if (animFrame) cancelAnimationFrame(animFrame);
      if (unlistenWake) unlistenWake();
      if (unlistenEnd) unlistenEnd();
    };
  });

  async function checkOnboarding() {
    try { const st = await getOnboardingStatus(); view = st.complete ? 'widget' : 'onboarding'; }
    catch { view = 'widget'; }
  }

  function cleanupRecording() {
    if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
    if (maxRecTimeout) { clearTimeout(maxRecTimeout); maxRecTimeout = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    analyser = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') { try { mediaRecorder.stop(); } catch (e) {} }
    mediaRecorder = null; audioChunks = [];
  }

  async function startRecording() {
    if (status === 'listening') return;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/wav';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      sttWs = new WebSocket('ws://localhost:8000/ws/voice-stream');
      sttWs.binaryType = 'arraybuffer';
      sttConnected = false;
      sttWs.onopen = () => { sttConnected = true; };
      sttWs.onclose = () => { sttConnected = false; };
      sttWs.onerror = () => { sttConnected = false; };
      sttWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'interim') interimText = data.text;
        else if (data.type === 'final') {
          interimText = data.text;
          if (data.speech_final && data.text.trim()) {
            const finalText = data.text.trim();
            stopRecording();
            sendUtterance(finalText);
          }
        }
      };
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && sttWs && sttWs.readyState === WebSocket.OPEN) {
          e.data.arrayBuffer().then((buf) => sttWs!.send(buf));
        }
      };
      mediaRecorder.onstop = () => {
        cleanupAudioNodes();
        if (sttWs && sttWs.readyState === WebSocket.OPEN) { sttWs.send(JSON.stringify({ type: 'close' })); sttWs.close(); }
        sttWs = null; sttConnected = false;
      };
      mediaRecorder.start(250);
      status = 'listening'; message = 'Słucham...'; interimText = ''; card = null;
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = Date.now();
      const checkSilence = () => {
        if (!analyser || !mediaRecorder || mediaRecorder.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        if (average < 5) { if (Date.now() - silenceStart > 4000) { stopRecording(); return; } }
        else { silenceStart = Date.now(); }
        silenceTimeout = setTimeout(checkSilence, 250);
      };
      silenceTimeout = setTimeout(checkSilence, 250);
      maxRecTimeout = setTimeout(() => stopRecording(), 10000);
    } catch (e) {
      message = 'Brak dostępu do mikrofonu. Użyj pola tekstowego.';
      showInput = true; setTimeout(() => inputRef?.focus(), 50); status = 'idle';
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') { try { mediaRecorder.stop(); } catch (e) {} }
    cleanupAudioNodes();
    if (sttWs) { if (sttWs.readyState === WebSocket.OPEN) { sttWs.send(JSON.stringify({ type: 'close' })); sttWs.close(); } sttWs = null; }
    sttConnected = false;
  }

  function cleanupAudioNodes() {
    if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
    if (maxRecTimeout) { clearTimeout(maxRecTimeout); maxRecTimeout = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    analyser = null;
    if (mediaRecorder && mediaRecorder.stream) { mediaRecorder.stream.getTracks().forEach(t => t.stop()); }
  }

  function toggleListening() { if (status === 'listening') stopRecording(); else startRecording(); }

  function sendUtterance(text: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) { message = 'Brak połączenia z backendem...'; status = 'idle'; return; }
    status = 'thinking'; message = 'Analizuję dane...';
    const payload: any = { type: 'utterance', text, mode };
    if (sessionId) payload.session_id = sessionId;
    ws.send(JSON.stringify(payload));
  }

  async function speak(text: string) {
    const API_BASE = "http://localhost:8000";
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')) {
      try {
        const mediaSource = new MediaSource();
        const audio = new Audio(); audio.src = URL.createObjectURL(mediaSource);
        currentAudio = audio;
        mediaSource.addEventListener('sourceopen', async () => {
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          const queue: ArrayBuffer[] = []; let updating = false;
          const appendNext = () => { if (updating || queue.length === 0) return; updating = true; const chunk = queue.shift()!; sourceBuffer.appendBuffer(chunk); };
          sourceBuffer.addEventListener('updateend', () => { updating = false; appendNext(); });
          const response = await fetch(`${API_BASE}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
          if (!response.ok || !response.body) throw new Error("TTS fetch failed");
          const reader = response.body.getReader();
          while (true) { const { done, value } = await reader.read(); if (done) break; queue.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)); appendNext(); }
          const waitDrain = () => new Promise<void>((resolve) => { const check = () => { if (queue.length === 0 && !sourceBuffer.updating) resolve(); else setTimeout(check, 50); }; check(); });
          await waitDrain(); if (mediaSource.readyState === 'open') mediaSource.endOfStream();
        });
        audio.onplay = () => { status = 'speaking'; };
        audio.onended = () => { status = 'idle'; message = 'Volle gotowa. Wciśnij Spację i mów.'; URL.revokeObjectURL(audio.src); currentAudio = null; };
        audio.onerror = () => { status = 'idle'; message = 'Volle gotowa. Wciśnij Spację i mów.'; URL.revokeObjectURL(audio.src); currentAudio = null; };
        await audio.play(); return;
      } catch (e) { console.error('MediaSource TTS error:', e); }
    }
    try {
      const blob = await tts(text); const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.onplay = () => { status = 'speaking'; };
      currentAudio.onended = () => { status = 'idle'; message = 'Volle gotowa. Wciśnij Spację i mów.'; URL.revokeObjectURL(url); currentAudio = null; };
      currentAudio.onerror = () => { status = 'idle'; message = 'Volle gotowa. Wciśnij Spację i mów.'; URL.revokeObjectURL(url); currentAudio = null; };
      await currentAudio.play();
    } catch (e) { console.error('TTS error:', e); status = 'idle'; message = 'Volle gotowa. Wciśnij Spację i mów.'; }
  }

  function cancelAll() {
    stopRecording(); if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    status = 'idle'; message = 'Volle gotowa. Wciśnij Spację i mów.';
  }

  function startNotificationPolling() { pollNotifications(); notifInterval = setInterval(pollNotifications, 30000); }
  function stopNotificationPolling() { if (notifInterval) { clearInterval(notifInterval); notifInterval = null; } }
  async function pollNotifications() {
    try { const data = await getNotifications(true); const notifs = data.notifications || []; notifications = notifs;
      if (notifs.length > lastNotifCount) { const newest = notifs[0]; if (newest && status === 'idle') speak(`${newest.title}. ${newest.message}`); }
      lastNotifCount = notifs.length;
    } catch (e) {}
  }

  function connect() {
    ws = new WebSocket('ws://localhost:8000/ws/voice');
    ws.onopen = () => { connected = true; };
    ws.onclose = () => { connected = false; setTimeout(connect, 2000); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') { message = 'Volle gotowa. Wciśnij Spację i mów.'; return; }
      if (data.type === 'response') {
        message = data.text; card = data.visual_card || null;
        if (data.session_id) sessionId = data.session_id;
        if (data.needs_confirmation && data.pending_action) { confirmMsg = data.text; pendingAction = data.pending_action; status = 'idle'; return; }
        speak(data.text);
      }
    };
  }

  function handleInputSubmit() { if (!inputText.trim()) return; sendUtterance(inputText.trim()); inputText = ''; showInput = false; }
  function handleInputKey(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); handleInputSubmit(); } }
  function toggleInput() { showInput = !showInput; if (showInput) setTimeout(() => inputRef?.focus(), 50); }
  function handleActionClick(a: any) { if (a.path) tauriOpenFolder(a.path).catch(() => {}); else if (a.app) tauriOpenApp(a.app).catch(() => {}); }
  function toggleSettings() { view = view === 'settings' ? 'widget' : 'settings'; }
  function confirmAction() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !pendingAction) { confirmMsg = ''; pendingAction = null; return; }
    const payload: any = { type: 'confirm', session_id: sessionId, tool: pendingAction.tool, args: pendingAction.args };
    ws.send(JSON.stringify(payload)); confirmMsg = ''; pendingAction = null; status = 'thinking'; message = 'Wykonuję...';
  }
  function cancelAction() { confirmMsg = ''; pendingAction = null; message = 'Anulowano. Volle gotowa.'; status = 'idle'; }
  function toggleActionLog() { showActionLog = !showActionLog; }
  function setMode(m: Mode) { mode = m; modeMenuOpen = false; }

  // Animated waveform canvas
  function startWaveform() {
    const draw = () => {
      if (!canvasRef) { animFrame = requestAnimationFrame(draw); return; }
      const ctx = canvasRef.getContext('2d'); if (!ctx) return;
      const w = canvasRef.width, h = canvasRef.height;
      ctx.clearRect(0, 0, w, h);
      if (status === 'listening' || status === 'speaking') {
        wavePhase += 0.08;
        ctx.strokeStyle = status === 'listening' ? 'rgba(252, 225, 0, 0.8)' : 'rgba(96, 205, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const amp = (status === 'listening' ? 12 : 8) * Math.sin(x * 0.03 + wavePhase) * (0.5 + 0.5 * Math.sin(x * 0.01 - wavePhase * 0.5));
          const y = h / 2 + amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Glow
        ctx.shadowBlur = 12; ctx.shadowColor = ctx.strokeStyle; ctx.stroke(); ctx.shadowBlur = 0;
      }
      animFrame = requestAnimationFrame(draw);
    };
    draw();
  }
</script>

{#if view === 'onboarding'}
  <Onboarding />
{:else if view === 'settings'}
  <div class="volle-widget settings-view">
    <Settings />
    <button class="fab-back" on:click={toggleSettings} aria-label="Powrót">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
  </div>
{:else}
  <main class="volle-widget" class:listening={status === 'listening'}>
    <!-- Top toolbar -->
    <div class="toolbar">
      <!-- Mode selector -->
      <div class="mode-wrap">
        <button class="mode-trigger" on:click={() => modeMenuOpen = !modeMenuOpen}>
          <span class="mode-dot {mode}"></span>
          <span class="mode-label">{mode === 'general' ? 'Ogólny' : mode === 'business' ? 'Biznes' : 'Desktop'}</span>
          <svg class="mode-chevron" class:open={modeMenuOpen} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        {#if modeMenuOpen}
          <div class="mode-menu">
            <button class="mode-item" class:active={mode === 'general'} on:click={() => setMode('general')}>
              <span class="mode-dot general"></span> Ogólny
            </button>
            <button class="mode-item" class:active={mode === 'business'} on:click={() => setMode('business')}>
              <span class="mode-dot business"></span> Biznes
            </button>
            <button class="mode-item" class:active={mode === 'desktop'} on:click={() => setMode('desktop')}>
              <span class="mode-dot desktop"></span> Desktop
            </button>
          </div>
        {/if}
      </div>

      <div class="toolbar-actions">
        <button class="icon-btn" on:click={toggleActionLog} title="Historia akcji">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
          {#if notifications.length > 0}<span class="dot-badge"></span>{/if}
        </button>
        <button class="icon-btn" on:click={toggleSettings} title="Ustawienia">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.9 17.9l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.07-4.93l-4.24 4.24M6.34 6.34l-4.24-4.24"/></svg>
        </button>
      </div>
    </div>

    <!-- Voice Orb -->
    <div class="orb-wrap">
      <div class="orb {status}" class:connected>
        {#if status === 'idle'}
          <svg class="orb-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        {:else if status === 'listening'}
          <svg class="orb-icon pulse" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        {:else if status === 'thinking'}
          <div class="spinner-ring"></div>
        {:else}
          <svg class="orb-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        {/if}
      </div>
      <canvas bind:this={canvasRef} width="160" height="40" class="waveform"></canvas>
    </div>

    <!-- Status -->
    <div class="status-area" class:has-interim={!!interimText}>
      <div class="status-text" class:fade={status !== 'idle' && status !== 'speaking'}>{message}</div>
      {#if interimText}
        <div class="interim-text" transition:fade={{ duration: 150 }}>{interimText}</div>
      {/if}
    </div>

    <!-- Controls -->
    {#if status === 'idle'}
      <div class="controls" transition:fade={{ duration: 200 }}>
        <button class="ptt-btn" on:click={toggleListening} aria-label="Naciśnij i mów">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          <span>Naciśnij i mów</span>
        </button>
        <button class="text-btn" on:click={toggleInput}>Lub wpisz tekst</button>
      </div>
    {/if}

    {#if showInput && status === 'idle'}
      <div class="input-row" transition:fade={{ duration: 180 }}>
        <input bind:this={inputRef} bind:value={inputText} on:keydown={handleInputKey} placeholder="Co chcesz zrobić?" class="fluent-input" />
        <button class="send-btn" on:click={handleInputSubmit} aria-label="Wyślij">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    {/if}

    <!-- Visual Card -->
    {#if card}
      <div class="card" transition:slide={{ duration: 300 }}>
        <div class="card-header">
          <span class="card-title">{card.title}</span>
        </div>
        <div class="card-body">
          {#if card.type === 'action'}
            {#each card.actions as a}
              <button class="action-row" on:click={() => handleActionClick(a)}>
                <span class="action-icon">{a.icon || '✓'}</span>
                <span class="action-text">{a.text}</span>
                <svg class="action-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            {/each}
          {:else}
            {#each card.metrics || [] as m}
              <div class="metric-row">
                <span class="metric-label">{m.label}</span>
                <span class="metric-value">{m.value}</span>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}

    {#if showActionLog && sessionId}
      <ActionLog sessionId={sessionId} />
    {/if}
  </main>
{/if}

<ConfirmDialog message={confirmMsg} onConfirm={confirmAction} onCancel={cancelAction} />

<script context="module" lang="ts">
  function fade(node: HTMLElement, { duration = 200 }) {
    return { duration, css: (t: number) => `opacity: ${t}; transform: translateY(${(1-t)*4}px);` };
  }
  function slide(node: HTMLElement, { duration = 300 }) {
    return { duration, css: (t: number) => `opacity: ${t}; transform: translateY(${(1-t)*10}px);` };
  }
</script>

<style>
  .volle-widget {
    width: 420px;
    height: 340px;
    background:
      radial-gradient(120% 100% at 50% 0%, rgba(96, 205, 255, 0.06) 0%, transparent 50%),
      radial-gradient(80% 60% at 20% 100%, rgba(124, 58, 237, 0.04) 0%, transparent 50%),
      linear-gradient(180deg, rgba(32, 32, 40, 0.96) 0%, rgba(24, 24, 32, 0.98) 100%);
    border-radius: var(--radius-2xl);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 22px;
    box-sizing: border-box;
    backdrop-filter: blur(40px) saturate(1.4);
    -webkit-backdrop-filter: blur(40px) saturate(1.4);
    border: 1px solid var(--mica-border);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.04),
      0 32px 64px -8px rgba(0,0,0,0.55),
      0 0 0 1px rgba(0,0,0,0.12);
    overflow: hidden;
    position: relative;
    font: var(--font-body);
  }

  /* Top toolbar */
  .toolbar {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    z-index: 2;
  }

  .mode-wrap { position: relative; }
  .mode-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 5px 12px;
    color: var(--text-secondary);
    font: var(--font-caption);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast);
  }
  .mode-trigger:hover { background: var(--surface-hover); border-color: var(--mica-border-active); }
  .mode-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .mode-dot.general { background: var(--accent); box-shadow: 0 0 6px var(--accent-glow); }
  .mode-dot.business { background: #a78bfa; box-shadow: 0 0 6px rgba(167,139,250,0.35); }
  .mode-dot.desktop { background: #6ccb5f; box-shadow: 0 0 6px rgba(108,203,95,0.35); }
  .mode-chevron { transition: transform var(--dur-fast) var(--ease-out); color: var(--text-tertiary); }
  .mode-chevron.open { transform: rotate(180deg); }

  .mode-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    background: rgba(36, 36, 48, 0.98);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-lg);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 140px;
    box-shadow: var(--shadow-lg);
    z-index: 10;
    animation: popIn 0.18s var(--ease-spring);
  }
  @keyframes popIn {
    from { opacity: 0; transform: scale(0.92) translateY(-4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .mode-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    color: var(--text-secondary);
    font: var(--font-caption);
    cursor: pointer;
    transition: background var(--dur-fast);
  }
  .mode-item:hover, .mode-item.active { background: var(--surface-hover); color: var(--text-primary); }

  .toolbar-actions { display: flex; align-items: center; gap: 4px; }
  .icon-btn {
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background var(--dur-fast), color var(--dur-fast);
  }
  .icon-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
  .dot-badge {
    position: absolute;
    top: 4px; right: 4px;
    width: 6px; height: 6px;
    background: var(--danger);
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(32,32,40,0.98);
  }

  /* Orb */
  .orb-wrap {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
    min-height: 84px;
  }
  .orb {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(80% 50% at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 100%, rgba(96,205,255,0.25) 0%, transparent 60%),
      linear-gradient(135deg, #3b82f6, #2563eb);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow:
      0 8px 32px rgba(37,99,235,0.3),
      inset 0 1px 0 rgba(255,255,255,0.15);
    color: #fff;
    transition: all 0.45s var(--ease-spring);
    position: relative;
    z-index: 2;
  }
  .orb .orb-icon { opacity: 0.95; }

  .orb.listening {
    background:
      radial-gradient(80% 50% at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 100%, rgba(252,225,0,0.25) 0%, transparent 60%),
      linear-gradient(135deg, #f59e0b, #d97706);
    box-shadow: 0 8px 32px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
    animation: orbPulse 1.2s ease-in-out infinite;
  }
  .orb.thinking {
    background:
      radial-gradient(80% 50% at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 100%, rgba(167,139,250,0.25) 0%, transparent 60%),
      linear-gradient(135deg, #8b5cf6, #7c3aed);
    box-shadow: 0 8px 32px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
  }
  .orb.speaking {
    background:
      radial-gradient(80% 50% at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 100%, rgba(96,205,255,0.25) 0%, transparent 60%),
      linear-gradient(135deg, #0ea5e9, #0284c7);
    box-shadow: 0 8px 32px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
    animation: orbSpeak 1.4s ease-out infinite;
  }
  @keyframes orbPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(217,119,6,0.35); }
    50% { transform: scale(1.08); box-shadow: 0 12px 40px rgba(217,119,6,0.5); }
  }
  @keyframes orbSpeak {
    0% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4), 0 8px 32px rgba(14,165,233,0.3); }
    70% { box-shadow: 0 0 0 14px rgba(14,165,233,0), 0 8px 32px rgba(14,165,233,0.3); }
    100% { box-shadow: 0 0 0 0 rgba(14,165,233,0), 0 8px 32px rgba(14,165,233,0.3); }
  }

  .spinner-ring {
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.15);
    border-top-color: #fff;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .waveform {
    position: absolute;
    bottom: -6px;
    width: 160px; height: 40px;
    opacity: 0.7;
    pointer-events: none;
  }

  /* Status */
  .status-area {
    width: 100%;
    text-align: center;
    margin-bottom: 10px;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .status-text {
    font: var(--font-body-strong);
    color: var(--text-secondary);
    line-height: 1.45;
    max-width: 320px;
    transition: opacity 0.2s;
  }
  .status-text.fade { opacity: 0.75; }
  .interim-text {
    font: var(--font-caption);
    color: var(--text-tertiary);
    font-style: italic;
    min-height: 16px;
  }

  /* Controls */
  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    animation: fadeIn 0.25s ease-out;
  }
  .ptt-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    border: none;
    color: #fff;
    padding: 10px 24px;
    border-radius: var(--radius-xl);
    font: var(--font-body-strong);
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
    transition: transform 0.15s var(--ease-out), box-shadow 0.15s;
  }
  .ptt-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(14,165,233,0.45); }
  .ptt-btn:active { transform: translateY(0); }
  .text-btn {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    font: var(--font-caption);
    cursor: pointer;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    transition: color 0.15s, background 0.15s;
  }
  .text-btn:hover { color: var(--text-secondary); background: var(--surface); }

  /* Input */
  .input-row {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 340px;
    margin-bottom: 4px;
    animation: fadeIn 0.2s ease-out;
  }
  .fluent-input {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-lg);
    padding: 9px 14px;
    color: var(--text-primary);
    font: var(--font-body);
    font-size: 13px;
    outline: none;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.15);
    transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
  }
  .fluent-input::placeholder { color: var(--text-disabled); }
  .fluent-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(96,205,255,0.12), inset 0 1px 2px rgba(0,0,0,0.1);
  }
  .send-btn {
    width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-lg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
  }
  .send-btn:hover { background: var(--surface-hover); border-color: var(--accent); color: var(--accent); }

  /* Card */
  .card {
    width: 100%;
    background: var(--surface-card);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-xl);
    padding: 14px;
    margin-top: 6px;
    box-shadow: var(--shadow-sm);
    animation: slideUp 0.35s var(--ease-out);
    backdrop-filter: blur(12px);
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .card-header { margin-bottom: 10px; }
  .card-title {
    font: var(--font-caption);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
  }
  .card-body { display: flex; flex-direction: column; gap: 2px; }
  .metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .metric-row:last-child { border-bottom: none; }
  .metric-label { font: var(--font-body); font-size: 13px; color: var(--text-secondary); }
  .metric-value { font: var(--font-body-strong); font-size: 14px; color: #e0f2fe; }

  .action-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    background: transparent;
    border: none;
    color: var(--text-primary);
    font: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background var(--dur-fast);
  }
  .action-row:hover { background: var(--surface-hover); }
  .action-icon { font-size: 15px; flex-shrink: 0; }
  .action-text { flex: 1; }
  .action-arrow { color: var(--text-tertiary); flex-shrink: 0; }

  /* FAB back */
  .fab-back {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: background var(--dur-fast), transform var(--dur-fast);
    z-index: 5;
  }
  .fab-back:hover { background: var(--surface-hover); transform: translateY(-2px); }

  /* Scrollable settings view */
  .settings-view { overflow-y: auto; padding-bottom: 60px; }
</style>
