<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface DrawerContentProps
  extends
    VaseUIComponentProps<DrawerContentState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

export interface DrawerContentState {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { DRAWER_CONTENT_ATTRIBUTE } from './drawerContentAttribute';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerContentProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DrawerContentState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerContentState>;
}>();

useDialogRootContext();

const state: DrawerContentState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ [DRAWER_CONTENT_ATTRIBUTE]: '' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
