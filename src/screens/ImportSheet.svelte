<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { addImport } from '../lib/storage/imports';
  import { parseMidi } from '../lib/music/midi';
  import { refreshImports, showToast } from '../lib/ui/store.svelte';

  let { presetTitle = '', onclose }: { presetTitle?: string; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let title = $state(presetTitle);
  let file = $state<File | null>(null);
  let error = $state('');
  let busy = $state(false);
  // svelte-ignore state_referenced_locally
  const isRiver = /river\s*flows/i.test(presetTitle);

  function pick(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
    file = f;
    error = '';
    if (f && !title.trim()) title = f.name.replace(/\.(mid|midi|kar)$/i, '').replace(/[_-]+/g, ' ').trim();
  }

  async function save() {
    if (!file) return;
    busy = true;
    error = '';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      parseMidi(bytes); // validate before saving
      await addImport(title.trim() || 'My song', bytes);
      await refreshImports();
      showToast(`Added ${title.trim() || 'your song'}. Find it in My imports.`);
      onclose();
    } catch (e) {
      error = `That file couldn’t be read as a MIDI song. ${e instanceof Error ? e.message : ''}`;
    } finally {
      busy = false;
    }
  }
</script>

<div class="scrim" transition:fade={{ duration: 160 }} onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Import a MIDI file" transition:fly={{ y: 500, duration: 240, opacity: 1 }}>
  <button class="orb-btn close" aria-label="Close" onclick={onclose}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>
  <h2>{isRiver ? 'Add River Flows in You' : 'Import a MIDI file'}</h2>
  {#if isRiver}
    <p class="lead">
      This song is still under copyright, so Keyfall can’t include it. You can add it yourself in under a minute:
    </p>
  {:else}
    <p class="lead">Any piano MIDI file works. Keyfall splits it into right and left hand for you.</p>
  {/if}
  <ol>
    <li>In Safari, search for <b>“{isRiver ? 'River Flows in You' : 'song name'} piano midi”</b>. Sites like MuseScore or BitMidi have free ones.</li>
    <li>Download the <b>.mid</b> file. It goes to Downloads in the Files app.</li>
    <li>Come back here, choose the file, and tap Add song.</li>
  </ol>

  <label class="file">
    <input type="file" onchange={pick} />
    <span class="btn-glass">{file ? 'Choose a different file' : 'Choose MIDI file'}</span>
    <span class="fname">{file ? file.name : 'No file chosen'}</span>
  </label>

  <label class="name">
    <span>Song name</span>
    <input type="text" bind:value={title} placeholder="My song" autocomplete="off" />
  </label>

  {#if error}<p class="error">{error}</p>{/if}
  <button class="btn-ember" disabled={!file || busy} onclick={save}>{busy ? 'Adding…' : 'Add song'}</button>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(4, 2, 4, 0.6);
  }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(620px, calc(100% - 20px));
    max-height: calc(100% - var(--sat) - 10px);
    overflow-y: auto;
    display: grid;
    gap: 14px;
    padding: 24px 22px calc(var(--sab) + 20px);
    border-radius: 30px 30px 0 0;
    background: rgba(24, 17, 19, 0.97);
    box-shadow: inset 0 1px 0 rgba(255, 170, 120, 0.2), 0 -20px 60px rgba(0, 0, 0, 0.6);
  }
  .close {
    position: absolute;
    top: 14px;
    right: 14px;
  }
  h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 34px;
    padding-right: 56px;
  }
  .lead,
  ol {
    color: var(--ivory-dim);
    line-height: 1.5;
  }
  ol {
    margin: 0;
    padding-left: 22px;
    display: grid;
    gap: 6px;
  }
  ol b {
    color: var(--ivory);
  }
  .file {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .file .btn-glass {
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .fname {
    color: var(--ivory-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    display: grid;
    gap: 6px;
    font-weight: 650;
  }
  .name input {
    min-height: 48px;
    padding: 0 14px;
    border-radius: 14px;
    border: 1px solid rgba(245, 239, 227, 0.18);
    background: rgba(8, 11, 28, 0.5);
    color: var(--ivory);
    font: inherit;
    font-size: 17px;
    -webkit-user-select: text;
    user-select: text;
  }
  .error {
    color: var(--danger);
    font-weight: 650;
  }
  .btn-ember:disabled {
    opacity: 0.5;
  }
</style>
