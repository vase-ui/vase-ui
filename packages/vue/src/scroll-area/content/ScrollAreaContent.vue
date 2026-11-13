<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot.vue';

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export interface ScrollAreaContentProps
  extends
    VaseUIComponentProps<ScrollAreaContentState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { onActivated, onDeactivated, shallowRef, watch } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import { useScrollAreaViewportContext } from '../viewport/ScrollAreaViewportContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaContentProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ScrollAreaContentState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaContentState>;
}>();

const { computeThumbPosition } = useScrollAreaViewportContext();
const { hasMeasuredScrollbar, viewportState } = useScrollAreaRootContext();

// One read, on purpose: the value of the first render.
const computeOnInitialResize = hasMeasuredScrollbar.value;

const { element, elementProps } = useRenderElement('div', props, {
  state: viewportState,
  stateAttributesMapping: scrollAreaStateAttributesMapping,
  props: (attrs) => [{ role: 'presentation', style: { minWidth: 'fit-content' } }, attrs],
});

// `KeepAlive` takes the element of a deactivated content out of the document. The element then has
// no layout, so the observer stops until the content is active again.
const isDeactivated = shallowRef(false);

onDeactivated(() => {
  isDeactivated.value = true;
});

onActivated(() => {
  isDeactivated.value = false;
});

watch(
  [element, isDeactivated],
  ([content, deactivated], _previous, onCleanup) => {
    if (typeof ResizeObserver === 'undefined' || !content || deactivated) {
      return;
    }

    let hasInitialized = false;
    const resizeObserver = new ResizeObserver(() => {
      if (!hasInitialized) {
        hasInitialized = true;

        // The observer calls its callback one time when it starts to observe. Skip that call, so
        // that the mount does not calculate the thumb position two times. Do not skip it when the
        // content mounted after the first measurement of the viewport. That call then brings the
        // overflow state in sync.
        if (!computeOnInitialResize) {
          return;
        }
      }

      computeThumbPosition();
    });

    resizeObserver.observe(content);

    onCleanup(() => {
      resizeObserver.disconnect();
    });
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="viewportState" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="viewportState" /></component>
</template>
