<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { fieldStateAttributes } from './control';
import { injectFieldRoot } from './root';
import type { FieldLabelProps, FieldLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldLabelProps>();
defineSlots<{
  default?(scope: { state: FieldLabelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldLabelState;
  }): unknown;
}>();

const field = injectFieldRoot('Label');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLLabelElement>();

const id = computed(() => props.id || generatedId);
// The element of the `element` slot is known after the mount. A `<label for>` names the control
// and moves the focus to it. Another element names the control by `aria-labelledby`.
const native = computed(() => !element.value || element.value.localName === 'label');

onUnmounted(
  field.addLabel({
    get id() {
      return id.value;
    },
    get native() {
      return native.value;
    },
  }),
);

const ownProps = computed(() => ({
  id: id.value,
  for: native.value ? field.controlId : undefined,
  ...fieldStateAttributes(field.state, field.state.disabled),
  onClick,
}));

function onClick(event: MouseEvent) {
  if (!native.value && !event.defaultPrevented) field.focusControl();
}

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="field.state"
  />
  <label v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="field.state" />
  </label>
</template>
