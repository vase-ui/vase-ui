<script setup lang="ts">
import type { PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';

// Two links of one root. The second link renders its element in the `element` slot, and the slot
// writes each of its renders. The popup renders a `<section>` in its `element` slot.
const props = defineProps({
  renders: { type: Array as PropType<string[]>, required: true },
});

function rendered(open: boolean) {
  props.renders.push(`second ${open}`);
  return 'Second';
}
</script>

<template>
  <PreviewCard.Root>
    <PreviewCard.Trigger id="first" href="#first" :delay="0" :close-delay="0">
      First
    </PreviewCard.Trigger>
    <PreviewCard.Trigger id="second" href="#second" style="margin-left: 40px">
      <template #element="{ props: linkProps, elementRef, state }">
        <a v-bind="linkProps" :ref="elementRef">{{ rendered(state.open) }}</a>
      </template>
    </PreviewCard.Trigger>
    <PreviewCard.Portal>
      <PreviewCard.Positioner>
        <PreviewCard.Popup>
          <template #element="{ props: popupProps, elementRef }">
            <section v-bind="popupProps" :ref="elementRef" data-testid="popup">Card</section>
          </template>
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
