<script lang="ts">
import type { HTMLAttributes } from 'vue';

export interface InternalBackdropProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The element to cut out of the backdrop.
   * This is useful for allowing certain elements to be interactive while the backdrop is present.
   */
  cutout?: Element | null | undefined;
}
</script>

<script setup lang="ts">
import { autoUpdate } from '@floating-ui/vue';
import { computed, onActivated, onDeactivated, shallowRef, watch } from 'vue';
import type { CSSProperties } from 'vue';

// As in Base UI, an attribute of a consumer wins over the role and the marker. The style of the
// part replaces a `style` of the consumer.
// The outside press check of `useDismiss` ignores a press on an element that a script added after
// the popup rendered. It takes an element for such an addition when none of the marked elements is
// in the root ancestor of that element. The marker keeps a press on the backdrop out of that rule.
defineOptions({ inheritAttrs: false });
const props = defineProps<InternalBackdropProps>();

const element = shallowRef<HTMLDivElement | null>(null);

// React measures the cutout when it renders the backdrop, and it renders the backdrop again with
// its positioner. A Vue child does not render with its parent. Thus `autoUpdate` raises this count
// when the cutout moves, and the clip path reads the count.
const measureCount = shallowRef(0);

const clipPath = computed(() => {
  void measureCount.value;
  const rect = props.cutout?.getBoundingClientRect();
  if (!rect) {
    return undefined;
  }
  return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
});

const style = computed<CSSProperties>(() => ({
  position: 'fixed',
  inset: 0,
  'user-select': 'none',
  '-webkit-user-select': 'none',
  ...(clipPath.value === undefined ? {} : { 'clip-path': clipPath.value }),
}));

// `KeepAlive` takes the element of a deactivated backdrop out of the document, and the observers
// of `autoUpdate` then have nothing to follow.
const isDeactivated = shallowRef(false);

onDeactivated(() => {
  isDeactivated.value = true;
});

onActivated(() => {
  isDeactivated.value = false;
});

watch(
  [() => props.cutout, element, isDeactivated],
  ([cutout, backdrop, deactivated], _previous, onCleanup) => {
    if (!cutout || !backdrop || deactivated) {
      return;
    }

    onCleanup(
      autoUpdate(cutout, backdrop, () => {
        measureCount.value += 1;
      }),
    );
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <div ref="element" role="presentation" data-vase-ui-inert="" v-bind="{ ...$attrs, style }" />
</template>
