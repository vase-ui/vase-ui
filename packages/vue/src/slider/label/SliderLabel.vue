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
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderLabelProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderLabelState>;
}>();

const { state, registerLabelId, controlElement, rootLabelId } = useSliderRootContext();

function focusControl(event: MouseEvent, controlId: string | undefined) {
  if (controlId) {
    const controlInput = getControlById(event.currentTarget as Element, controlId);
    if (isHTMLElement(controlInput)) {
      focusElementWithVisible(controlInput);
      return;
    }
  }

  const fallbackInputs = controlElement.value?.querySelectorAll('input[type="range"]');
  const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
  if (isHTMLElement(fallbackInput)) {
    focusElementWithVisible(fallbackInput);
  }
}

const labelProps = useLabel({ id: rootLabelId, registerLabelId, focusControl });

const { element, elementProps } = useRenderElement('div', props, {
  state,
  // The id of the label derives from the root, so the `id` of a consumer does not replace it.
  props: ({ id: _id, ...attrs }) => [labelProps.value, attrs],
  stateAttributesMapping: sliderStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
