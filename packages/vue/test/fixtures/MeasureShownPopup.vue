<script setup lang="ts">
import { inject, onMounted, shallowRef } from 'vue';

// A part that hides its own root element with `v-show`, as `Popover.Popup` does. The element
// shows one update after its mount, and it is inert while the scene is closed.
const scene = inject<{ open: boolean }>('scene')!;
const entered = shallowRef(false);
onMounted(() => (entered.value = true));
</script>

<template>
  <div v-show="scene.open && entered" class="popup" :inert="scene.open ? undefined : true">
    Popup
  </div>
</template>
