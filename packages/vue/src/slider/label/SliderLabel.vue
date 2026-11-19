<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderLabelState extends SliderRootState {}

export interface SliderLabelProps
  extends
    VaseUIComponentProps<SliderLabelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {}
</script>

<script setup lang="ts">
import { isHTMLElement } from '@floating-ui/utils/dom';
import {
  focusElementWithVisible,
  getControlById,
  useLabel,
} from '../../internals/labelable-provider/useLabel';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { sliderStateAttributesMapping, useSliderRootContext } from '../root/SliderRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderLabelProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderLabelState>;
}>();

const { state, registerLabelId, thumbList, rootLabelId } = useSliderRootContext();

function focusControl(event: MouseEvent, controlId: string | undefined) {
  if (controlId) {
    const controlInput = getControlById(event.currentTarget as Element, controlId);
    if (isHTMLElement(controlInput)) {
      focusElementWithVisible(controlInput);
      return;
    }
  }

  let singleInput: HTMLInputElement | null = null;
  for (const [thumb, entry] of thumbList.map.value) {
    const input = thumb.isConnected && entry.getInput();
    if (input) {
      if (singleInput) {
        return;
      }
      singleInput = input;
    }
  }
  if (singleInput) {
    focusElementWithVisible(singleInput);
  }
}

const labelProps = useLabel({
  id: rootLabelId,
  element: () => element.value,
  registerLabelId,
  focusControl,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  // The id of the label derives from the root, so the `id` of a consumer does not replace it.
  props: ({ id: _id, ...attrs }) => [labelProps.value, attrs],
  stateAttributesMapping: sliderStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
