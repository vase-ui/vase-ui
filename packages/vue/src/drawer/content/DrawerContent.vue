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
import { useElementRegistration } from '../../internals/useElementRegistration';
import { EMPTY_OBJECT } from '../../common/empty';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { drawerContents, DRAWER_CONTENT_ATTRIBUTE } from '../root/DrawerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerContentProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DrawerContentState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerContentState>;
}>();

const store = useDialogRootContext();

const state: DrawerContentState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ [DRAWER_CONTENT_ATTRIBUTE]: '' }, attrs],
});

useElementRegistration(drawerContents, element, () => store);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
