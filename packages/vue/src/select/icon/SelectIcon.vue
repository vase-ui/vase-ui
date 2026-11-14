<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectIconState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
}

export interface SelectIconProps
  extends
    VaseUIComponentProps<SelectIconState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectIconProps>(), { as: 'span' });

defineSlots<{
  /**
   * The content of the icon. The default is `▼`.
   */
  default(props: { state: SelectIconState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectIconState>;
}>();

const store = useSelectRootContext();

const state = computed<SelectIconState>(() => ({ open: store.select('open') }));

const { element, elementProps } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
  stateAttributesMapping: triggerOpenStateMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state">▼</slot></component>
</template>
