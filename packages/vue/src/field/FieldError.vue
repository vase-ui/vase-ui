<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { fieldStateAttributes } from './control';
import { injectFieldRoot } from './root';
import type { FieldErrorProps, FieldErrorState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldErrorProps>();
const slots = defineSlots<{
  default?(scope: { state: FieldErrorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldErrorState;
    messages: string[];
  }): unknown;
}>();

const field = injectFieldRoot('Error');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLDivElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
const invalid = computed(() =>
  props.match ? field.validity[props.match] : field.state.valid === false,
);
const { waiting } = useEnterAfterLeave(() => invalid.value, element);
const shown = computed(() => invalid.value && !waiting.value);
const messages = computed(() =>
  !props.match && field.formErrors.length > 0 ? field.formErrors : field.errors,
);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = field.addDescriber({
  // The `element` slot can give the element another `id`.
  get id() {
    return (slots.element && element.value?.id) || elementId.value;
  },
  get shown() {
    return shown.value;
  },
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    { id: elementId.value, ...fieldStateAttributes(field.state, field.state.disabled) },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="field.state"
    :messages="messages"
  />
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="field.state">
      <template v-if="messages.length === 1">{{ messages[0] }}</template>
      <ul v-else-if="messages.length > 1">
        <li v-for="(message, index) in messages" :key="index">{{ message }}</li>
      </ul>
    </slot>
  </div>
</template>
