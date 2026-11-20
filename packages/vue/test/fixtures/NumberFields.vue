<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { NumberField } from '../../src/number-field';

type Attrs = Record<string, unknown>;

// One number field in a form. Each prop gives the attributes of a part. With no `area`, the field
// has no scrub area, and with `input: null` no text input. `parts` can remove the buttons, the
// input or the scrub area after the mount, and put a second input in a `<Transition>` in the place
// of the input.
defineProps({
  root: Object as PropType<Attrs>,
  input: { type: Object as PropType<Attrs | null>, default: () => ({}) },
  increment: Object as PropType<Attrs>,
  decrement: Object as PropType<Attrs>,
  area: Object as PropType<Attrs>,
  parts: {
    type: Object as PropType<{
      buttons?: boolean;
      input?: boolean;
      second?: boolean;
      area?: boolean;
    }>,
    default: () => ({}),
  },
  submitButton: Boolean,
});
defineEmits<{ inputLeft: [] }>();
const field = useTemplateRef('field');
defineExpose({ field });
</script>

<template>
  <form id="form">
    <label for="amount">Amount</label>
    <NumberField.Root ref="field" v-bind="root">
      <NumberField.ScrubArea v-if="area && parts.area !== false" v-bind="area">
        <span class="Scrub">Scrub</span>
      </NumberField.ScrubArea>
      <NumberField.Group>
        <NumberField.Decrement
          v-if="parts.buttons !== false"
          aria-label="Decrease"
          v-bind="decrement"
          >−</NumberField.Decrement
        >
        <Transition @after-leave="$emit('inputLeft')">
          <NumberField.Input v-if="input && parts.input !== false" id="amount" v-bind="input" />
          <NumberField.Input v-else-if="parts.second" id="second" aria-label="Second" />
        </Transition>
        <NumberField.Increment
          v-if="parts.buttons !== false"
          aria-label="Increase"
          v-bind="increment"
          >+</NumberField.Increment
        >
      </NumberField.Group>
    </NumberField.Root>
    <button v-if="submitButton">Submit</button>
    <button type="reset">Reset</button>
  </form>
  <form id="other"></form>
</template>
