<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

  let status: Status = 'idle';
  let message = 'Wciśnij Ctrl+Shift+Space i mów...';
  let card: any = null;
  let ws: WebSocket | null = null;
  let connected = false;

  onMount(() => {
    connect();
    const keyHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        activate();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  });

  function connect() {
    ws = new WebSocket('ws://localhost:8000/ws/voice');
    ws.onopen = () => { connected = true; };
    ws.onclose = () => { connected = false; setTimeout(connect, 2000); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') {
        message = 'Volle gotowa. Wciśnij Ctrl+Shift+Space.';
        return;
      }
      if (data.type === 'response') {
        status = 'speaking';
        message = data.text;
        card = data.visual_card || null;
        setTimeout(() => { status = 'idle'; }, 6000);
      }
    };
  }

  function activate() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      message = 'Brak połączenia z backendem...';
      return;
    }
    status = 'listening';
    message = 'Słucham...';
    card = null;
    // Prototype: simulate user utterance after short delay
    setTimeout(() => {
      status = 'thinking';
      message = 'Analizuję dane...';
      ws!.send(JSON.stringify({
        type: 'utterance',
        text: 'Na podstawie sprzedaży z wczorajszego dnia porównaj ze sprzedażą z całego miesiąca i daj mi podsumowanie'
      }));
    }, 1500);
  }
</script>

<main class="volle-widget">
  <div class="header">
    <div class="orb {status}"></div>
    <div class="connection" class:online={connected}></div>
  </div>
  <div class="status-text">{message}</div>
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
</style>
