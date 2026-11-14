<script lang="ts">
import type { LiHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface NavigationMenuItemState {}

export interface NavigationMenuItemProps
  extends
    VaseUIComponentProps<NavigationMenuItemState>,
    /* @vue-ignore */ WithVaseUIEvent<LiHTMLAttributes> {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { useVaseUiId } from '../../internals/useBaseUiId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { NavigationMenuItemContext } from './NavigationMenuItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuItemProps>(), { as: 'li' });

defineSlots<{
  default(props: { state: NavigationMenuItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuItemState>;
}>();

const state: NavigationMenuItemState = EMPTY_OBJECT;

const fallbackValue = useVaseUiId();

provide(NavigationMenuItemContext, {
  value: computed(() => props.value ?? fallbackValue.value),
});

const { element, elementProps } = useRenderElement('li', props);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
