<script lang="ts">
  import Planet from './Planet.svelte';
  import type { CatalogEntry } from '../songs/catalog';

  /** The composer's portrait, or a crisp planet for songs without one. */
  let { entry, size = 64, round = true, spin = 0 }: { entry: CatalogEntry; size?: number; round?: boolean; spin?: number } = $props();
</script>

<span class="avatar" class:round style:width="{size}px" style:height="{size}px">
  {#if entry.portrait}
    <img src={entry.portrait} alt="" width={size} height={size} loading="lazy" decoding="async" />
  {:else}
    <span class="planet-wrap"><Planet seed={entry.id} palette={entry.palette} size={size * 0.72} {spin} glow={0.8} /></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    overflow: hidden;
    border-radius: 18px;
    background: radial-gradient(circle at 50% 40%, #2a1210, #0b0607);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
  }
  .avatar.round {
    border-radius: 50%;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .planet-wrap {
    display: grid;
    place-items: center;
  }
</style>
