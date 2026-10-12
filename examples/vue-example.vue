<!-- Vue 3 — main.ts: app.use(WebDimens) from 'webdimens/vue' -->
<script setup lang="ts">
import { sdp, ssp } from 'webdimens';
import { useDimen } from 'webdimens/vue';
const pad = useDimen(() => sdp(16));
const title = useDimen(() => ssp(20));
</script>

<template>
  <section :style="{ padding: `${pad}px` }">
    <h2 :style="{ fontSize: `${title}px` }">Hello</h2>
    <p class="body">Declarative CSS tokens work too.</p>
  </section>
</template>

<style scoped>
.body { font-size: calc(14 * var(--ssp)); margin-top: calc(8 * var(--sdp)); }
</style>
