<script lang="ts">
import type { PartialAPI } from '@shared/ipc'

const api = (window as unknown as { api: PartialAPI }).api

function handleOpen() {
  api?.showOpenDialog()
}
</script>

<div class="welcome">
  <h2>Partial</h2>
  <p>Agent-native project management via .plan files</p>
  <button onclick={handleOpen}>Open Plan File</button>
  <p class="hint">Or use File &gt; Open (Cmd/Ctrl+O)</p>
</div>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    gap: 0.75rem;
  }

  h2 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-primary);
  }

  p {
    color: var(--color-text-dim);
    margin: 0;
    font-size: 0.95rem;
  }

  button {
    margin-top: 1rem;
    padding: 0.625rem 1.5rem;
    background: var(--color-surface-active);
    color: var(--color-text-inverse);
    border: 1px solid var(--color-border-accent);
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
  }

  button:hover {
    background: var(--color-surface-active-hover);
  }

  .hint {
    font-size: 0.8rem;
    color: var(--color-text-hint);
  }
</style>
