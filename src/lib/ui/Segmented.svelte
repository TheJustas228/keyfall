<script lang="ts" generics="T extends string">
  let {
    options,
    value,
    onchange,
    label,
    disabled = false,
  }: { options: { value: T; label: string }[]; value: T; onchange: (v: T) => void; label: string; disabled?: boolean } = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label} class:disabled>
  {#each options as o (o.value)}
    <button
      role="radio"
      aria-checked={o.value === value}
      class:active={o.value === value}
      {disabled}
      onclick={() => onchange(o.value)}>{o.label}</button
    >
  {/each}
</div>

<style>
  .seg {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--glass);
    box-shadow: inset 0 0 0 1px var(--hair);
  }
  .seg.disabled {
    opacity: 0.4;
  }
  button {
    flex: 1;
    min-height: 44px;
    border-radius: 999px;
    font-weight: 500;
    font-size: 16px;
    color: var(--muted);
    transition: background 0.15s ease, color 0.15s ease;
  }
  button.active {
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 0 1px var(--hair-strong);
    color: var(--ivory);
  }
</style>
