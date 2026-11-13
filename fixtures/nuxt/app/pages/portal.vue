<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import FloatingPortalLite from '../../../../packages/vue/src/utils/popups/portal/FloatingPortalLite.vue';

// The portal is internal, so no entry point of the package exports it.
// Vue unwraps a template ref in a template. The `container` prop is `null` until the mount.
const page = useTemplateRef<HTMLElement>('page');

// Nuxt renders the element `#teleports` for its own `Teleport`. A server has no such element in
// the page, so the page reads it after the mount.
const teleports = shallowRef<HTMLElement | null>(null);
onMounted(() => {
  teleports.value = document.getElementById('teleports');
});
</script>

<template>
  <main>
    <button data-testid="trigger" type="button">trigger</button>
    <div id="page" ref="page" />
    <FloatingPortalLite data-testid="in-body"><p>in body</p></FloatingPortalLite>
    <FloatingPortalLite data-testid="in-page" :container="page"><p>in page</p></FloatingPortalLite>
    <FloatingPortalLite data-testid="in-teleports" :container="teleports">
      <p>in teleports</p>
    </FloatingPortalLite>
    <FloatingPortalLite data-testid="no-container" :container="null">
      <p>no container</p>
    </FloatingPortalLite>
  </main>
</template>
