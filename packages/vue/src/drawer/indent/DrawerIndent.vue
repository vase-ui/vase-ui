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
import { computed, watch } from 'vue';
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
const visualStateStore = providerContext?.visualStateStore;

const state = computed<DrawerIndentState>(() => ({
  active: providerContext?.active.value ?? false,
}));

function swipeProgressValue() {
  const swipeProgress = visualStateStore?.getSnapshot().swipeProgress ?? 0;
  return swipeProgress <= 0 ? '0' : `${swipeProgress}`;
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
  // Vue writes each key of the style again when the part renders. The store is not reactive, so
  // the render gives the progress of the gesture and does not run again for each of its frames.
  props: (attrs) => [
    { style: { [DrawerBackdropCssVars.swipeProgress]: swipeProgressValue() } },
    attrs,
  ],
});

watch(
  element,
  (indent, _previous, onCleanup) => {
    if (!indent || !visualStateStore) {
      return;
    }

    const syncVisualState = () => {
      const { frontmostHeight } = visualStateStore.getSnapshot();
      indent.style.setProperty(DrawerBackdropCssVars.swipeProgress, swipeProgressValue());

      if (frontmostHeight <= 0) {
        indent.style.removeProperty(DrawerPopupCssVars.height);
      } else {
        indent.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
      }
    };

    syncVisualState();

    const unsubscribe = visualStateStore.subscribe(syncVisualState);
    onCleanup(() => {
      unsubscribe();
      indent.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      indent.style.removeProperty(DrawerPopupCssVars.height);
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
