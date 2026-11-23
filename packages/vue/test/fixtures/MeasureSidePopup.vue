<script setup lang="ts">
import { inject, onMounted, shallowRef, type Ref } from 'vue';

// A part that hides its own root element with `v-show`, as `Popover.Popup` does. The element shows
// one update after its mount, and its `data-side` is the side of the floating element.
const side = inject<Readonly<Ref<string>>>('side')!;
const entered = shallowRef(false);
onMounted(() => (entered.value = true));
</script>

<template>
  <div v-show="entered" data-testid="popup" :data-side="side" style="width: 100px; height: 100px">
    Popup
  </div>
</template>
