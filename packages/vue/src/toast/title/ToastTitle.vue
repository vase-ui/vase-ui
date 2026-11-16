<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleProps
  extends
    VaseUIComponentProps<ToastTitleState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the title. The toast uses it for `aria-labelledby`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastLabelPart } from '../utils/useToastLabelPart';
import ToastTitleChildren from './ToastTitleChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastTitleProps>(), { as: 'h2' });

defineSlots<{
  default(props: { state: ToastTitleState }): unknown;
  render(props: { props: HTMLProps; state: ToastTitleState; children: Component }): unknown;
}>();

const { labelId, rendered, state } = useToastLabelPart(() => props.id, 'title');

const { element, elementProps } = useRenderElement('h2', props, {
  state,
  props: (attrs) => [{ id: labelId.value }, attrs],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="rendered">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ToastTitleChildren" />
    <component :is="as" v-else v-bind="elementProps()"><ToastTitleChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ToastTitleChildren></component>
  </template>
</template>
