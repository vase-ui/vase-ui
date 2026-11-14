<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ToastContentState {
  /**
   * Whether the toast viewport is expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast is behind the frontmost toast in the stack.
   */
  behind: boolean;
}

export interface ToastContentProps
  extends
    VaseUIComponentProps<ToastContentState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, shallowRef, watch } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastContentProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToastContentState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastContentState>;
}>();

const { visibleIndex, expanded, recalculateHeight } = useToastRootContext();

const state = computed<ToastContentState>(() => ({
  expanded: expanded.value,
  behind: visibleIndex.value > 0,
}));

const { element, elementProps } = useRenderElement('div', props, { state });

// `KeepAlive` takes the element of a deactivated content out of the document. The element then has
// no layout, so the height stays as it was until the content is active again.
const deactivated = shallowRef(false);

onDeactivated(() => {
  deactivated.value = true;
});

onActivated(() => {
  deactivated.value = false;
});

watch(
  [element, deactivated],
  ([node, isDeactivated], _previous, onCleanup) => {
    if (isDeactivated) {
      return;
    }

    recalculateHeight();

    if (!node || typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => recalculateHeight());
    const mutationObserver = new MutationObserver(() => recalculateHeight());

    resizeObserver.observe(node);
    mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });

    onCleanup(() => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
