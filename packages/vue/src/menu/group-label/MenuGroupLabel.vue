<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuGroupLabelState {}

export interface MenuGroupLabelProps
  extends
    VaseUIComponentProps<MenuGroupLabelState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuGroupRootContext } from '../group/MenuGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuGroupLabelProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuGroupLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuGroupLabelState>;
}>();

const state: MenuGroupLabelState = EMPTY_OBJECT;

const id = useVaseUiId(() => props.id);

const registerLabelId = useMenuGroupRootContext();
const source = Symbol();

useRegisteredId(
  () => id.value,
  (getId) => registerLabelId(source, getId),
);

const { element, elementProps } = useRenderElement('div', props, {
  props: (attrs) => [{ id: id.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
