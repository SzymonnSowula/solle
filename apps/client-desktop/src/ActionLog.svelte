<script lang="ts">
  import { onMount } from "svelte";
  import { listActions, listUndoable, undoAction } from "./lib/api";

  export let sessionId: string;

  let actions: any[] = [];
  let undoable: any[] = [];
  let error = "";
  let loading = false;

  async function refresh() {
    loading = true;
    try {
      const [allRes, undoRes] = await Promise.all([
        listActions(sessionId),
        listUndoable(sessionId),
      ]);
      actions = allRes.actions || [];
      undoable = undoRes.actions || [];
      error = "";
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function undo(id: number) {
    try {
      await undoAction(id);
      await refresh();
    } catch (e: any) {
      error = e.message;
    }
  }

  onMount(refresh);
</script>

<div class="action-log">
  <div class="log-header">
    <div class="log-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
      <span>Historia akcji</span>
    </div>
    <button class="icon-btn" on:click={refresh} disabled={loading} title="Odśwież">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
    </button>
  </div>

  {#if error}
    <div class="log-error">{error}</div>
  {/if}

  {#if undoable.length > 0}
    <div class="undo-bar">
      <span class="undo-title">Cofnij ostatnią</span>
      <div class="undo-chips">
        {#each undoable.slice(0, 3) as a}
          <button class="undo-chip" on:click={() => undo(a.id)}>
            <span>#{a.id}</span>
            <span class="chip-name">{a.tool_name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="log-list">
    {#each actions as a}
      <div class="log-row" class:undone={a.status === "undone"}>
        <span class="log-badge">{a.tool_name}</span>
        <span class="log-status">{a.status}</span>
        <span class="log-time">{new Date(a.created_at).toLocaleTimeString("pl-PL", { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    {:else}
      <div class="log-empty">Brak akcji w tej sesji</div>
    {/each}
  </div>
</div>

<style>
  .action-log {
    position: absolute;
    bottom: 80px;
    right: 16px;
    width: 280px;
    max-height: 320px;
    overflow-y: auto;
    background: linear-gradient(180deg, rgba(40,40,52,0.98) 0%, rgba(32,32,44,0.98) 100%);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-xl);
    padding: 14px;
    color: var(--text-primary);
    font: var(--font-caption);
    z-index: 50;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .log-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font: var(--font-body-strong);
    font-size: 13px;
  }
  .icon-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; border-radius: var(--radius-sm);
    color: var(--text-tertiary); cursor: pointer;
    transition: background var(--dur-fast), color var(--dur-fast);
  }
  .icon-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
  .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .log-error {
    color: var(--danger);
    font: var(--font-caption);
    background: rgba(255,153,164,0.06);
    border: 1px solid rgba(255,153,164,0.12);
    border-radius: var(--radius-md);
    padding: 6px 10px;
  }

  .undo-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .undo-title {
    font: var(--font-caption);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .undo-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .undo-chip {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface);
    border: 1px solid var(--mica-border);
    border-radius: var(--radius-md);
    padding: 4px 10px;
    color: var(--text-secondary);
    font: var(--font-caption);
    cursor: pointer;
    transition: background var(--dur-fast), border-color var(--dur-fast);
  }
  .undo-chip:hover { background: var(--surface-hover); border-color: var(--danger); color: var(--danger); }
  .chip-name { opacity: 0.8; }

  .log-list { display: flex; flex-direction: column; gap: 3px; }
  .log-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    background: var(--surface);
    transition: background var(--dur-fast);
  }
  .log-row:hover { background: var(--surface-hover); }
  .log-row.undone { opacity: 0.45; text-decoration: line-through; }
  .log-badge {
    background: rgba(96,205,255,0.08);
    color: var(--accent);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font: var(--font-caption);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1px solid rgba(96,205,255,0.12);
  }
  .log-status { font: var(--font-caption); color: var(--text-tertiary); font-size: 11px; }
  .log-time { font: var(--font-caption); color: var(--text-disabled); font-size: 11px; font-variant-numeric: tabular-nums; }
  .log-empty {
    text-align: center;
    color: var(--text-disabled);
    padding: 16px 0;
    font: var(--font-caption);
  }
</style>
