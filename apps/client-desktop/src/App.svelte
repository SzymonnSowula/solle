<script lang="ts">
  import { onMount } from 'svelte';
  import Onboarding from './Onboarding.svelte';
  import Settings from './Settings.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ActionLog from './ActionLog.svelte';
  import { getOnboardingStatus, stt, tts, getNotifications } from './lib/api';
  import { tauriOpenFolder, tauriOpenApp } from './lib/tauri';

  type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
  type View = 'widget' | 'onboarding' | 'settings';

  let view: View = 'onboarding';
  let status: Status = 'idle';
  let message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
  let card: any = null;
  let ws: WebSocket | null = null;
  let connected = false;
  let inputText = '';
  let showInput = false;
  let interimText = '';
  let inputRef: HTMLInputElement | null = null;
  let sessionId: string | null = null;

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

  onMount(() => {
    checkOnboarding();
    connect();
    startNotificationPolling();

    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        toggleListening();
        return;
      }
      if (e.code === 'Space' && !e.ctrlKey && !e.shiftKey && !e.metaKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && view === 'widget') {
        e.preventDefault();
        if (!spaceHeld) {
          spaceHeld = true;
          startRecording();
        }
        return;
      }
      if (e.key === 'Escape') {
        cancelAll();
      }
    };

    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceHeld) {
        spaceHeld = false;
        stopRecording();
      }
    };

    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);
    window.addEventListener('onboarding-complete', () => { view = 'widget'; });
    return () => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
      window.removeEventListener('onboarding-complete', () => {});
      cleanupRecording();
      stopNotificationPolling();
    };
  });

  async function checkOnboarding() {
    try {
      const st = await getOnboardingStatus();
      view = st.complete ? 'widget' : 'onboarding';
    } catch {
      view = 'widget';
    }
  }

  function cleanupRecording() {
    if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
    if (maxRecTimeout) { clearTimeout(maxRecTimeout); maxRecTimeout = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    analyser = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) {}
    }
    mediaRecorder = null;
    audioChunks = [];
  }

  async function startRecording() {
    if (status === 'listening') return;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/wav';
      mediaRecorder = new MediaRecorder(stream, { mimeType });

      // Connect to streaming STT WebSocket
      sttWs = new WebSocket('ws://localhost:8000/ws/voice-stream');
      sttWs.binaryType = 'arraybuffer';
      sttConnected = false;

      sttWs.onopen = () => { sttConnected = true; };
      sttWs.onclose = () => { sttConnected = false; };
      sttWs.onerror = () => { sttConnected = false; };
      sttWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'interim') {
          interimText = data.text;
        } else if (data.type === 'final') {
          interimText = data.text;
          if (data.speech_final && data.text.trim()) {
            // Final transcript ready
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
        if (sttWs && sttWs.readyState === WebSocket.OPEN) {
          sttWs.send(JSON.stringify({ type: 'close' }));
          sttWs.close();
        }
        sttWs = null;
        sttConnected = false;
      };

      mediaRecorder.start(250); // send chunk every 250ms
      status = 'listening';
      message = 'Słucham...';
      interimText = '';
      card = null;

      // Silence detection
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = Date.now();

      const checkSilence = () => {
        if (!analyser || !mediaRecorder || mediaRecorder.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        if (average < 5) {
          if (Date.now() - silenceStart > 4000) {
            stopRecording();
            return;
          }
        } else {
          silenceStart = Date.now();
        }
        silenceTimeout = setTimeout(checkSilence, 250);
      };
      silenceTimeout = setTimeout(checkSilence, 250);
      maxRecTimeout = setTimeout(() => stopRecording(), 10000);
    } catch (e) {
      message = 'Nie udało się uzyskać dostępu do mikrofonu. Użyj pola tekstowego.';
      showInput = true;
      setTimeout(() => inputRef?.focus(), 50);
      status = 'idle';
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.stop(); } catch (e) {}
    }
    cleanupAudioNodes();
    if (sttWs) {
      if (sttWs.readyState === WebSocket.OPEN) {
        sttWs.send(JSON.stringify({ type: 'close' }));
        sttWs.close();
      }
      sttWs = null;
    }
    sttConnected = false;
  }

  function cleanupAudioNodes() {
    if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
    if (maxRecTimeout) { clearTimeout(maxRecTimeout); maxRecTimeout = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    analyser = null;
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  }

  function toggleListening() {
    if (status === 'listening') {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function sendUtterance(text: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      message = 'Brak połączenia z backendem...';
      status = 'idle';
      return;
    }
    status = 'thinking';
    message = 'Analizuję dane...';
    const payload: any = { type: 'utterance', text };
    if (sessionId) payload.session_id = sessionId;
    ws.send(JSON.stringify(payload));
  }

  async function speak(text: string) {
    const API_BASE = "http://localhost:8000";
    // Use MediaSource for chunked playback if supported
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')) {
      try {
        const mediaSource = new MediaSource();
        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        currentAudio = audio;

        mediaSource.addEventListener('sourceopen', async () => {
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          const queue: ArrayBuffer[] = [];
          let updating = false;

          const appendNext = () => {
            if (updating || queue.length === 0) return;
            updating = true;
            const chunk = queue.shift()!;
            sourceBuffer.appendBuffer(chunk);
          };

          sourceBuffer.addEventListener('updateend', () => {
            updating = false;
            appendNext();
          });

          const response = await fetch(`${API_BASE}/api/voice/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!response.ok || !response.body) {
            throw new Error("TTS fetch failed");
          }

          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            queue.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
            appendNext();
          }

          // Wait for queue to drain then end stream
          const waitDrain = () =>
            new Promise<void>((resolve) => {
              const check = () => {
                if (queue.length === 0 && !sourceBuffer.updating) {
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            });
          await waitDrain();
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
        });

        audio.onplay = () => { status = 'speaking'; };
        audio.onended = () => {
          status = 'idle';
          message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
          URL.revokeObjectURL(audio.src);
          currentAudio = null;
        };
        audio.onerror = () => {
          status = 'idle';
          message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
          URL.revokeObjectURL(audio.src);
          currentAudio = null;
        };
        await audio.play();
        return;
      } catch (e) {
        console.error('MediaSource TTS error:', e);
        // Fallback to blob below
      }
    }

    // Fallback: download full blob
    try {
      const blob = await tts(text);
      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.onplay = () => { status = 'speaking'; };
      currentAudio.onended = () => {
        status = 'idle';
        message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
        URL.revokeObjectURL(url);
        currentAudio = null;
      };
      currentAudio.onerror = () => {
        status = 'idle';
        message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
        URL.revokeObjectURL(url);
        currentAudio = null;
      };
      await currentAudio.play();
    } catch (e) {
      console.error('TTS error:', e);
      status = 'idle';
      message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
    }
  }

  function cancelAll() {
    stopRecording();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    status = 'idle';
    message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
  }

  function startNotificationPolling() {
    pollNotifications();
    notifInterval = setInterval(pollNotifications, 30000);
  }

  function stopNotificationPolling() {
    if (notifInterval) { clearInterval(notifInterval); notifInterval = null; }
  }

  async function pollNotifications() {
    try {
      const data = await getNotifications(true);
      const notifs = data.notifications || [];
      notifications = notifs;
      if (notifs.length > lastNotifCount) {
        // New notifications arrived
        const newest = notifs[0];
        if (newest && status === 'idle') {
          speak(`${newest.title}. ${newest.message}`);
        }
      }
      lastNotifCount = notifs.length;
    } catch (e) {
      // silent fail
    }
  }

  function connect() {
    ws = new WebSocket('ws://localhost:8000/ws/voice');
    ws.onopen = () => { connected = true; };
    ws.onclose = () => { connected = false; setTimeout(connect, 2000); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') {
        message = 'Volle gotowa. Wciśnij Spację i mów lub wpisz polecenie.';
        return;
      }
      if (data.type === 'response') {
        message = data.text;
        card = data.visual_card || null;
        if (data.session_id) sessionId = data.session_id;
        if (data.needs_confirmation && data.pending_action) {
          confirmMsg = data.text;
          pendingAction = data.pending_action;
          status = 'idle';
          return;
        }
        speak(data.text);
      }
    };
  }

  function handleInputSubmit() {
    if (!inputText.trim()) return;
    sendUtterance(inputText.trim());
    inputText = '';
    showInput = false;
  }

  function handleInputKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputSubmit();
    }
  }

  function toggleInput() {
    showInput = !showInput;
    if (showInput) setTimeout(() => inputRef?.focus(), 50);
  }

  function handleActionClick(a: any) {
    if (a.path) {
      tauriOpenFolder(a.path).catch(() => {});
    } else if (a.app) {
      tauriOpenApp(a.app).catch(() => {});
    }
  }

  function toggleSettings() {
    view = view === 'settings' ? 'widget' : 'settings';
  }

  function confirmAction() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !pendingAction) {
      confirmMsg = '';
      pendingAction = null;
      return;
    }
    const payload: any = {
      type: 'confirm',
      session_id: sessionId,
      tool: pendingAction.tool,
      args: pendingAction.args,
    };
    ws.send(JSON.stringify(payload));
    confirmMsg = '';
    pendingAction = null;
    status = 'thinking';
    message = 'Wykonuję...';
  }

  function cancelAction() {
    confirmMsg = '';
    pendingAction = null;
    message = 'Anulowano. Volle gotowa.';
    status = 'idle';
  }

  function toggleActionLog() {
    showActionLog = !showActionLog;
  }
</script>

{#if view === 'onboarding'}
  <Onboarding />
{:else if view === 'settings'}
  <div class="volle-widget">
    <Settings />
    <button class="back-btn" on:click={toggleSettings}>
      Powrót
    </button>
  </div>
{:else}
  <main class="volle-widget">
    <div class="header">
      <div class="orb {status}"></div>
      <div class="connection" class:online={connected}></div>
      {#if view === 'widget'}
        <button class="settings-btn" on:click={toggleSettings} title="Ustawienia">
          ⚙️
        </button>
        <button class="history-btn" on:click={toggleActionLog} title="Historia akcji">
          📜
        </button>
        <button class="notif-btn" on:click={() => {}} title="Powiadomienia">
          🔔
          {#if notifications.length > 0}
            <span class="notif-badge">{notifications.length}</span>
          {/if}
        </button>
      {/if}
    </div>

    <div class="status-text">{message}</div>
    {#if interimText}
      <div class="interim-text">{interimText}</div>
    {/if}

    {#if status === 'idle'}
      <div class="controls">
        <button class="ptt-btn" on:click={toggleListening} aria-label="Naciśnij i mów">
          {showInput ? 'Anuluj' : 'Naciśnij i mów'}
        </button>
        <button class="text-toggle" on:click={toggleInput}>
          {showInput ? 'Ukryj tekst' : 'Lub wpisz tekst'}
        </button>
      </div>
    {/if}

    {#if showInput && status === 'idle'}
      <div class="input-row">
        <input
          bind:this={inputRef}
          bind:value={inputText}
          on:keydown={handleInputKey}
          placeholder="Co chcesz zrobić?"
          class="fallback-input"
        />
        <button class="send-btn" on:click={handleInputSubmit}>Wyślij</button>
      </div>
    {/if}

    {#if card}
      <div class="card">
        <h3>{card.title}</h3>
        {#if card.type === 'action'}
          {#each card.actions as a}
            <div class="action" class:clickable={a.path || a.app} on:click={() => handleActionClick(a)}>
              <span class="action-icon">{a.icon || '✓'}</span>
              <span class="action-text">{a.text}</span>
            </div>
          {/each}
        {:else}
          {#each card.metrics || [] as m}
            <div class="metric">
              <span class="label">{m.label}</span>
              <span class="value">{m.value}</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    {#if showActionLog && sessionId}
      <ActionLog sessionId={sessionId} />
    {/if}
  </main>
{/if}

<ConfirmDialog message={confirmMsg} onConfirm={confirmAction} onCancel={cancelAction} />

<style>
  .volle-widget {
    width: 420px;
    height: 340px;
    background: rgba(16, 16, 24, 0.95);
    border-radius: 28px;
    color: #f0f0f5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 28px;
    box-sizing: border-box;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 24px 64px rgba(0,0,0,0.45);
    overflow: hidden;
  }
  .header {
    position: relative;
    margin-bottom: 20px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .orb {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #a5f3fc, #0ea5e9);
    box-shadow: 0 0 48px rgba(14, 165, 233, 0.35);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .orb.listening {
    animation: pulse 1.1s infinite ease-in-out;
    background: radial-gradient(circle at 35% 35%, #fde68a, #f59e0b);
    box-shadow: 0 0 56px rgba(245, 158, 11, 0.45);
  }
  .orb.thinking {
    animation: spin 2.2s linear infinite;
    background: radial-gradient(circle at 35% 35%, #d8b4fe, #7c3aed);
    box-shadow: 0 0 56px rgba(124, 58, 237, 0.4);
  }
  .orb.speaking {
    animation: ripple 1.2s infinite ease-out;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.18); opacity: 0.82; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes ripple {
    0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.45); }
    70% { box-shadow: 0 0 0 22px rgba(14, 165, 233, 0); }
    100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
  }
  .connection {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ef4444;
    border: 2px solid rgba(16,16,24,0.95);
    transition: background 0.3s;
  }
  .connection.online {
    background: #22c55e;
  }
  .settings-btn {
    position: absolute;
    top: -10px;
    right: -10px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
  }
  .settings-btn:hover { color: rgba(255,255,255,0.9); }
  .status-text {
    font-size: 15.5px;
    line-height: 1.5;
    text-align: center;
    opacity: 0.92;
    min-height: 48px;
    margin-bottom: 8px;
  }
  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    animation: fadeIn 0.2s ease-out;
  }
  .ptt-btn {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    border: none;
    color: #fff;
    padding: 10px 22px;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .ptt-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(14, 165, 233, 0.45);
  }
  .ptt-btn:active {
    transform: translateY(0);
  }
  .text-toggle {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.55);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .text-toggle:hover {
    color: rgba(255,255,255,0.85);
  }
  .input-row {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 340px;
    margin-bottom: 8px;
    animation: fadeIn 0.2s ease-out;
  }
  .fallback-input {
    flex: 1;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 9px 12px;
    color: #f0f0f5;
    font-size: 13px;
    outline: none;
  }
  .fallback-input::placeholder {
    color: rgba(255,255,255,0.35);
  }
  .fallback-input:focus {
    border-color: rgba(14, 165, 233, 0.6);
  }
  .send-btn {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.12);
    color: #f0f0f5;
    padding: 9px 14px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .send-btn:hover {
    background: rgba(255,255,255,0.18);
  }
  .card {
    width: 100%;
    background: rgba(255,255,255,0.055);
    border-radius: 18px;
    padding: 18px;
    margin-top: 4px;
    animation: slideIn 0.35s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .card h3 {
    margin: 0 0 14px 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.55;
    font-weight: 600;
  }
  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .metric:last-child { border-bottom: none; }
  .label { font-size: 13px; opacity: 0.7; }
  .value { font-size: 14px; font-weight: 700; color: #e0f2fe; }
  .action {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .action:last-child { border-bottom: none; }
  .action-icon { font-size: 14px; }
  .action-text { font-size: 14px; color: #f0f0f5; }
  .action.clickable { cursor: pointer; }
  .action.clickable:hover { background: rgba(255,255,255,0.04); border-radius: 8px; }
  .history-btn {
    position: absolute;
    top: -10px;
    right: 24px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
  }
  .history-btn:hover { color: rgba(255,255,255,0.9); }
  .notif-btn {
    position: absolute;
    top: -10px;
    right: 44px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
  }
  .notif-btn:hover { color: rgba(255,255,255,0.9); }
  .notif-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  .back-btn {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.7);
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 13px;
    cursor: pointer;
    margin-top: 12px;
  }
  .interim-text {
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    text-align: center;
    min-height: 20px;
    margin-bottom: 4px;
    font-style: italic;
  }
</style>
