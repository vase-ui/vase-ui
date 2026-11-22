<script setup lang="ts">
import type { PropType } from 'vue';
import type { Dialog } from '../../src/dialog';
import type { Drawer } from '../../src/drawer';

// The popup of `DialogFocusTargets`, with the parts of its family.
defineProps({
  parts: { type: Object as PropType<typeof Dialog | typeof Drawer>, required: true },
  popup: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <component
    :is="parts.Popup"
    data-testid="popup"
    style="position: fixed; left: 200px; top: 100px"
    v-bind="popup"
  >
    <input data-testid="inside-1" aria-label="Inside 1" />
    <input data-testid="inside-2" aria-label="Inside 2" />
    <component :is="parts.Close" data-testid="close">Close</component>
  </component>
</template>
