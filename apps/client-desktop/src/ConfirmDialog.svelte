<script lang="ts">
  export let message: string = '';
  export let onConfirm: () => void;
  export let onCancel: () => void;

  $: visible = !!message;
</script>

{#if visible}
  <div class="overlay" on:click={onCancel} transition:fade={{ duration: 220 }}>
    <div class="dialog" on:click|stopPropagation transition:scale={{ duration: 260 }}>
      <div class="dialog-accent"></div>
      <div class="dialog-body">
        <h3>Potwierdź akcję</h3>
        <p>{message}</p>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" on:click={onCancel}>Anuluj</button>
        <button class="btn-confirm" on:click={onConfirm}>Potwierdź</button>
      </div>
    </div>
  </div>
{/if}

<script context="module">
  function fade(node: HTMLElement, { duration = 220 }) {
    return {
      duration,
      css: (t: number) => `opacity: ${t};`,
    };
  }
  function scale(node: HTMLElement, { duration = 260 }) {
    return {
      duration,
      css: (t: number) => {
        const eased = 1 - Math.pow(1 - t, 3);
        return `opacity: ${t}; transform: scale(${0.88 + eased * 0.12}) translateY(${(1 - eased) * 16}px);`;
      },
    };
  }
</script>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px) saturate(0.8);
  }
  .dialog {
    position: relative;
    background: linear-gradient(180deg, rgba(40, 40, 52, 0.99) 0%, rgba(32, 32, 44, 0.99) 100%);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 340px;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
  }
  .dialog-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--accent), #a78bfa);
    opacity: 0.8;
  }
  .dialog-body {
    padding: 22px 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dialog-body h3 {
    margin: 0;
    font: var(--font-subtitle);
    font-size: 16px;
    color: var(--text-primary);
  }
  .dialog-body p {
    margin: 0;
    font: var(--font-body);
    color: var(--text-secondary);
    line-height: 1.55;
  }
  .dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding: 8px 16px 16px;
  }
  .btn-cancel {
    background: transparent;
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 7px 16px;
    color: var(--text-secondary);
    font: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    transition: background var(--dur-fast), border-color var(--dur-fast);
  }
  .btn-cancel:hover { background: var(--surface-hover); border-color: var(--mica-border-active); }
  .btn-confirm {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    border: none;
    border-radius: var(--radius-md);
    padding: 7px 16px;
    color: #fff;
    font: var(--font-body-strong);
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(14,165,233,0.3);
    transition: transform var(--dur-fast), box-shadow var(--dur-fast);
  }
  .btn-confirm:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(14,165,233,0.4); }
  .btn-confirm:active { transform: translateY(0); }
</style>
