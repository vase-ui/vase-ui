<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface DrawerIndentState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentProps
  extends
    VaseUIComponentProps<DrawerIndentState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

const stateAttributesMapping: StateAttributesMapping<DrawerIndentState> = {
  active(value): Record<string, string> | null {
    if (value) {
      return { 'data-active': '' };
    }
    return { 'data-inactive': '' };
  },
};
</script>

<script setup lang="ts">
import { computed, toRaw, watch } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerIndentProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DrawerIndentState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerIndentState>;
}>();

const providerContext = useDrawerProviderContext();

const state = computed<DrawerIndentState>(() => ({
  active: providerContext?.active.value ?? false,
}));

function swipeProgress() {
  return Math.max(0, toRaw(providerContext)?.visualState.swipeProgress ?? 0);
}

const height = computed(() => providerContext?.visualState.frontmostHeight ?? 0);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
  props: (attrs) => [
    {
      style: {
        [DrawerBackdropCssVars.swipeProgress]: swipeProgress(),
        [DrawerPopupCssVars.height]: height.value > 0 ? `${height.value}px` : undefined,
      },
    },
    attrs,
  ],
});

// A bound progress value on the indent added more than 10% to frame work.
watch(
  () => providerContext?.visualState.swipeProgress,
  () => {
    element.value?.style.setProperty(DrawerBackdropCssVars.swipeProgress, String(swipeProgress()));
  },
  { flush: 'sync' },
);

watch(
  element,
  (indent, _, onCleanup) => {
    if (indent && providerContext) {
      onCleanup(() => {
        // Vue has no further patch for the retired element.
        indent.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
        indent.style.removeProperty(DrawerPopupCssVars.height);
      });
    }
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
