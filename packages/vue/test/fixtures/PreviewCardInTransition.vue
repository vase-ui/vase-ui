<script setup lang="ts">
import type { PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';

type Props = Record<string, unknown>;

// Two links and a popup in a `<Transition appear>` in a portal. The leave of the popup takes
// 300 ms. With `keepMounted` on the portal, Vue runs no transition, and an animation of `[hidden]`
// that fills forwards hides the kept popup in 300 ms.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
});
</script>

<template>
  <PreviewCard.Root v-bind="root">
    <PreviewCard.Trigger id="a" href="#a" v-bind="trigger">A</PreviewCard.Trigger>
    <PreviewCard.Trigger id="b" href="#b" v-bind="trigger" style="margin-left: 200px">
      B
    </PreviewCard.Trigger>
    <PreviewCard.Portal v-bind="portal">
      <PreviewCard.Positioner data-testid="positioner">
        <Transition name="card" appear>
          <PreviewCard.Popup data-testid="popup" class="card">Card</PreviewCard.Popup>
        </Transition>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>

<style>
.card-leave-active {
  transition: opacity 300ms;
}
.card-leave-to {
  opacity: 0;
}
.card[hidden] {
  display: block;
  animation: card-hide 300ms forwards;
}
@keyframes card-hide {
  to {
    opacity: 0;
  }
}
</style>
