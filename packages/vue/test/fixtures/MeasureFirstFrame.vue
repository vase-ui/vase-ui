<script setup lang="ts">
import { autoUpdate, offset, useFloating } from '@floating-ui/vue';
import { useTemplateRef, type PropType } from 'vue';

// A floating element that Floating UI places at its reference while `open`.
defineProps({
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
const reference = useTemplateRef<HTMLElement>('reference');
const floating = useTemplateRef<HTMLElement>('floating');
const { floatingStyles } = useFloating(reference, floating, {
  placement: 'bottom',
  middleware: [offset(10)],
  whileElementsMounted: autoUpdate,
});
</script>

<template>
  <button ref="reference" style="margin: 100px">Anchor</button>
  <div v-if="scene.open" ref="floating" data-testid="floating" :style="floatingStyles">Popup</div>
</template>
