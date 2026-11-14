<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionProps
  extends
    VaseUIComponentProps<ToastDescriptionState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the description. The toast uses it for `aria-describedby`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastLabelPart } from '../utils/useToastLabelPart';
import ToastDescriptionChildren from './ToastDescriptionChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastDescriptionProps>(), { as: 'p' });

defineSlots<{
  default(props: { state: ToastDescriptionState }): unknown;
  render(props: { props: HTMLProps; state: ToastDescriptionState; children: Component }): unknown;
}>();

const { labelId, rendered, state } = useToastLabelPart(() => props.id, 'description');

const { element, elementProps } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: labelId.value }, attrs],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="rendered">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ToastDescriptionChildren" />
    <component :is="as" v-else v-bind="elementProps()"><ToastDescriptionChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ToastDescriptionChildren></component>
  </template>
</template>
