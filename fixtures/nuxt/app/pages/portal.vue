<script setup lang="ts">
import { useTemplateRef } from 'vue';
import PopupPortal from '../../../../packages/vue/src/utils/popups/portal/PopupPortal.vue';

const page = useTemplateRef<HTMLElement>('page');

</script>

<template>
  <main>
    <button data-testid="trigger" type="button">trigger</button>
    <div id="page" ref="page" />
    <PopupPortal data-testid="in-body"><p>in body</p></PopupPortal>
    <PopupPortal data-testid="in-page" :to="page"><p>in page</p></PopupPortal>
    <PopupPortal data-testid="in-teleports" to="#teleports">
      <p>in teleports</p>
    </PopupPortal>
    <PopupPortal data-testid="no-container" :to="null">
      <p>no container</p>
    </PopupPortal>
  </main>
</template>
