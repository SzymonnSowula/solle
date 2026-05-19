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
  <div class="header">
    <strong>Historia akcji</strong>
    <button class="refresh" on:click={refresh} disabled={loading}>🔄</button>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if undoable.length > 0}
    <div class="undo-section">
      <span class="undo-label">Cofnij ostatnią:</span>
      {#each undoable.slice(0, 3) as a}
        <button class="undo-btn" on:click={() => undo(a.id)}>
          #{a.id} {a.tool_name}
        </button>
      {/each}
    </div>
  {/if}

  <div class="list">
    {#each actions as a}
      <div class="row" class:undone={a.status === "undone"}>
        <span class="badge">{a.tool_name}</span>
        <span class="status">{a.status}</span>
        <span class="time">{new Date(a.created_at).toLocaleTimeString("pl-PL")}</span>
      </div>
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
    background: rgba(20, 20, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px;
    color: #eee;
    font-size: 12px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .refresh {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #ccc;
  }
  .error {
    color: #ff6b6b;
    margin-bottom: 6px;
  }
  .undo-section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
    align-items: center;
  }
  .undo-label {
    color: #aaa;
  }
  .undo-btn {
    background: #3a3a5a;
    border: 1px solid #5a5a8a;
    color: #eee;
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 11px;
  }
  .undo-btn:hover {
    background: #5a5a8a;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
  }
  .row.undone {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .badge {
    background: #2a3a5a;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    text-transform: uppercase;
  }
  .status {
    font-size: 10px;
    color: #888;
  }
  .time {
    font-size: 10px;
    color: #666;
  }
</style>
