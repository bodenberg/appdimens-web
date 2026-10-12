<script>
  // Svelte — call install() once in your entry (main.js).
  import { sdp, ssp } from 'webdimens';
  import { dimen } from 'webdimens/svelte';
  const pad = dimen(() => sdp(16));
  const title = dimen(() => ssp(20));
</script>

<section style="padding: {$pad}px">
  <h2 style="font-size: {$title}px">Hello</h2>
  <p class="body">Or use the CSS tokens directly.</p>
</section>

<style>
  .body { font-size: calc(14 * var(--ssp)); }
</style>
