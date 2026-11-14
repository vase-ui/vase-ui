<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuGroupState {}

export interface MenuGroupProps
  extends VaseUIComponentProps<MenuGroupState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { MenuGroupContext } from './MenuGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuGroupState>;
}>();

const state: MenuGroupState = EMPTY_OBJECT;

const { ids: labelIds, registerId } = createIdRegistry();

provide(MenuGroupContext, registerId);

const labelId = computed(() => labelIds.value.at(-1));

const { element, elementProps } = useRenderElement('div', props, {
  props: (attrs) => [{ role: 'group', 'aria-labelledby': labelId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
