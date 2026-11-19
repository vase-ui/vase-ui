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
   * The id of the description. The toast uses it for `aria-describedby`. A toast with no title
   * uses it for `aria-labelledby` instead, unless the consumer gives the toast a non-blank
   * `aria-label` or `aria-labelledby`.
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

const { labelId, hasContent, state } = useToastLabelPart(
  () => props.id,
  'description',
  () => element.value,
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: labelId.value }, attrs],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="hasContent() && usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ToastDescriptionChildren" />
  <component :is="as" v-else-if="hasContent()" v-bind="elementProps()" :ref="setRef">
    <ToastDescriptionChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ToastDescriptionChildren>
  </component>
</template>
