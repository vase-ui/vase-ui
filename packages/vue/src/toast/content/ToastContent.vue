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
import { computed, watch } from 'vue';
import { useResizeObserver } from '../../common/useResizeObserver';
import { useMutationObserver } from '../../common/useMutationObserver';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, { state });

const { isHeld } = useKeepAliveState();
watch(
  [element, isHeld],
  ([, held]) => {
    if (!held) recalculateHeight();
  },
  { flush: 'post' },
);
useResizeObserver(element, recalculateHeight);
useMutationObserver(
  element,
  { childList: true, subtree: true, characterData: true },
  recalculateHeight,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
