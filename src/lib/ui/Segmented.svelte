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
    border-radius: 16px;
    background: rgba(8, 11, 28, 0.55);
  }
  .seg.disabled {
    opacity: 0.4;
  }
  button {
    flex: 1;
    min-height: 44px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 16px;
    color: var(--ivory-dim);
    transition: background 0.15s ease, color 0.15s ease;
  }
  button.active {
    background: var(--ivory);
    color: #141a3a;
  }
</style>
