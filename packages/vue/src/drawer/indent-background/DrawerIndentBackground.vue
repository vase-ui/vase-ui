<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface DrawerIndentBackgroundState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentBackgroundProps
  extends
    VaseUIComponentProps<DrawerIndentBackgroundState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

const stateAttributesMapping: StateAttributesMapping<DrawerIndentBackgroundState> = {
  active(value): Record<string, string> | null {
    if (value) {
      return { 'data-active': '' };
    }
    return { 'data-inactive': '' };
  },
};
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerIndentBackgroundProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DrawerIndentBackgroundState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerIndentBackgroundState>;
}>();

const providerContext = useDrawerProviderContext();

const state = computed<DrawerIndentBackgroundState>(() => ({
  active: providerContext?.active.value ?? false,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
