<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

  let status: Status = 'idle';
  let message = 'Wciśnij Spację i mów lub wpisz polecenie...';
  let card: any = null;
  let ws: WebSocket | null = null;
  let connected = false;
  let inputText = '';
  let showInput = false;
  let recognition: any = null;
  let synth: SpeechSynthesis | null = null;
  let plVoice: SpeechSynthesisVoice | null = null;
  let interimText = '';
  let inputRef: HTMLInputElement | null = null;

  onMount(() => {
    connect();
    initSynthesis();
    initSpeechRecognition();

    const keyHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        toggleListening();
        return;
      }
      if (e.code === 'Space' && !e.ctrlKey && !e.shiftKey && !e.metaKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        toggleListening();
        return;
      }
      if (e.key === 'Escape') {
        cancelAll();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  });

  function initSynthesis() {
    synth = window.speechSynthesis;
    if (!synth) return;

    const pickVoice = () => {
      const voices = synth!.getVoices();
      plVoice = voices.find(v => v.lang.startsWith('pl')) || voices.find(v => v.lang.toLowerCase().includes('pol')) || null;
    };

    pickVoice();
    if (synth.getVoices().length === 0 && 'onvoiceschanged' in synth) {
      synth.onvoiceschanged = pickVoice;
    }
  }

  function initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message = 'Twoja przeglądarka nie obsługuje rozpoznawania mowy. Użyj pola tekstowego.';
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      status = 'listening';
      message = 'Słucham...';
      interimText = '';
      card = null;
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      interimText = interim;
      if (final) {
        stopListening();
        sendUtterance(final);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        message = 'Błąd rozpoznawania mowy. Spróbuj ponownie.';
      }
      if (status === 'listening') {
        status = 'idle';
        message = 'Wciśnij Spację i mów lub wpisz polecenie...';
      }
    };

    recognition.onend = () => {
      if (status === 'listening') {
        status = 'idle';
        message = 'Wciśnij Spację i mów lub wpisz polecenie...';
      }
    };
  }

  function toggleListening() {
    if (status === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    if (!recognition) {
      showInput = true;
      setTimeout(() => inputRef?.focus(), 50);
      return;
    }
    if (synth?.speaking) synth.cancel();
    try {
      recognition.start();
    } catch (e) {
      // already started
    }
  }

  function stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
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
    ws.send(JSON.stringify({ type: 'utterance', text }));
  }

  function speak(text: string) {
    if (!synth) return;
    if (synth.speaking) synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.rate = 1;
    utterance.pitch = 1;
    if (plVoice) utterance.voice = plVoice;

    utterance.onstart = () => {
      status = 'speaking';
    };
    utterance.onend = () => {
      status = 'idle';
      message = 'Wciśnij Spację i mów lub wpisz polecenie...';
    };
    utterance.onerror = () => {
      status = 'idle';
      message = 'Wciśnij Spację i mów lub wpisz polecenie...';
    };

    synth.speak(utterance);
  }

  function cancelAll() {
    if (recognition) try { recognition.abort(); } catch (e) {}
    if (synth?.speaking) synth.cancel();
    status = 'idle';
    message = 'Wciśnij Spację i mów lub wpisz polecenie...';
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
    if (showInput) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  }
</script>

<main class="volle-widget">
  <div class="header">
    <div class="orb {status}"></div>
    <div class="connection" class:online={connected}></div>
  </div>

  <div class="status-text">{message}</div>

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
        placeholder="Co chcesz wiedzieć?"
        class="fallback-input"
      />
      <button class="send-btn" on:click={handleInputSubmit}>Wyślij</button>
    </div>
  {/if}

  {#if card}
    <div class="card">
      <h3>{card.title}</h3>
      {#each card.metrics as m}
        <div class="metric">
          <span class="label">{m.label}</span>
          <span class="value">{m.value}</span>
        </div>
      {/each}
    </div>
  {/if}
</main>

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
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
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
</style>
