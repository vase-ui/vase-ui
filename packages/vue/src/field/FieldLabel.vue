<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { fieldStateAttributes } from './control';
import { injectFieldRoot } from './root';
import type { FieldLabelProps, FieldLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldLabelProps>();
const slots = defineSlots<{
  default?(scope: { state: FieldLabelState }): unknown;
  element?(scope: ElementSlotProps<FieldLabelState>): unknown;
}>();

const field = injectFieldRoot('Label');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLLabelElement>();

const elementId = computed(() => givenId(props.id) ?? generatedId);
// The element of the `element` slot is known after the mount. A `<label for>` names the control
// and moves the focus to it. Another element names the control by `aria-labelledby`.
const native = computed(() => !element.value || element.value.localName === 'label');

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = field.addLabel({
  // The `element` slot can give the element another `id`.
  get id() {
    return (slots.element && element.value?.id) || elementId.value;
  },
  get native() {
    return native.value;
  },
});
onUnmounted(unregister);

const ownProps = computed(() => ({
  id: elementId.value,
  for: native.value ? field.controlId : undefined,
  ...fieldStateAttributes(field.state, field.state.disabled),
  onClick,
}));

// With no `for`, the browser does not move the focus at a click.
function onClick(event: MouseEvent) {
  if ((!native.value || !field.controlId) && !event.defaultPrevented) field.focusControl();
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
