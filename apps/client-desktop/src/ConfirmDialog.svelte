<script lang="ts">
  export let message: string = '';
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

{#if message}
  <div class="overlay">
    <div class="dialog">
      <h3>Potwierdź akcję</h3>
      <p>{message}</p>
      <div class="buttons">
        <button class="btn-cancel" on:click={onCancel}>Anuluj</button>
        <button class="btn-confirm" on:click={onConfirm}>Potwierdź</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  .dialog {
    background: rgba(24, 24, 36, 0.98);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 24px;
    max-width: 340px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  h3 { margin: 0; font-size: 16px; color: #e0f2fe; }
  p { margin: 0; font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.5; }
  .buttons {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 4px;
  }
  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.7);
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    cursor: pointer;
  }
  .btn-confirm {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    border: none;
    color: #fff;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
