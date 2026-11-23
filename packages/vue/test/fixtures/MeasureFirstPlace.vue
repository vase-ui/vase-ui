<script setup lang="ts">
import { autoUpdate, flip, useFloating } from '@floating-ui/vue';
import { provide, useTemplateRef, type PropType } from 'vue';
import MeasureSidePopup from './MeasureSidePopup.vue';

// A reference at the bottom of the view, and a floating element that Floating UI places under it
// while `open`, with `top` and `left`. The view has no room under the reference, so `flip()` places
// it above. The floating element has a transition of `top`. In it, a part in a `<Transition>` shows
// its element one update after its mount, and the `enter-from` of the element depends on its side.
defineProps({
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
const reference = useTemplateRef<HTMLElement>('reference');
const floating = useTemplateRef<HTMLElement>('floating');
const { floatingStyles, placement } = useFloating(reference, floating, {
  placement: 'bottom',
  middleware: [flip()],
  transform: false,
  whileElementsMounted: autoUpdate,
});
provide('side', placement);
</script>

<template>
  <button ref="reference" style="position: fixed; left: 100px; bottom: 10px">Anchor</button>
  <div
    v-if="scene.open"
    ref="floating"
    data-testid="floating"
    class="first-place"
    :style="floatingStyles"
  >
    <Transition name="side">
      <MeasureSidePopup />
    </Transition>
  </div>
</template>

<style>
.first-place {
  transition: top 1s linear;
}
.side-enter-active {
  transition: transform 1s linear;
}
.side-enter-from[data-side='bottom'] {
  transform: translateY(-50px);
}
.side-enter-from[data-side='top'] {
  transform: translateY(50px);
}
</style>
