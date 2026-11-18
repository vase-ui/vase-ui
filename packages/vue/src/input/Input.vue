<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type {
  FieldControlChangeEventDetails,
  FieldControlChangeEventReason,
  FieldControlState,
} from '../field';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface InputState extends FieldControlState {}

export type InputChangeEventReason = FieldControlChangeEventReason;

export type InputChangeEventDetails = FieldControlChangeEventDetails;

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface InputAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface InputProps
  extends
    VaseUIComponentProps<InputState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<InputHTMLAttributes>,
      'autocomplete' | 'disabled' | 'id' | 'name' | 'value'
    >,
    /* @vue-ignore */ InputAutocomplete {
  /**
   * The `id` of the input. The label of the field names the input with it.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * The `name` prop on `<Field.Root>` takes precedence over this.
   */
  name?: string | undefined;
  /**
   * The default value of the input. Use when uncontrolled.
   */
  defaultValue?: string | number | string[] | undefined;
  /**
   * The value of the input. Use when controlled.
   */
  value?: string | number | readonly string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { FieldControl } from '../field';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { withoutPropsOf } from '../internals/withoutPropsOf';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<InputProps>(), {
  as: 'input',
  disabled: false,
  value: undefined,
});

const emit = defineEmits<{
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  valueChange: [value: string, eventDetails: InputChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model:value` uses it.
   */
  'update:value': [value: string];
}>();

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, InputState>;
}>();

// As in Base UI, this part renders `Field.Control` and makes no element of its own. The two parts
// then share the value, the state and the validation.
// The template has one form for `#render` and one for no slot. A `v-if` on a slot template makes
// the slots of `Field.Control` dynamic. Vue then renders `Field.Control` again each time this part
// renders.
const control = useTemplateRef('control');
const element = computed(() => control.value?.element ?? null);

// Vue takes a declared event out of `$attrs`, so the template gives `Field.Control` a listener for
// each event. Each handler emits the event again at once with the same arguments.
// `Field.Control` reads `details.isCanceled` after its `valueChange` emit returns. A
// `details.cancel()` in a listener of this part thus stops `update:value`.
function emitValueChange(value: string, eventDetails: InputChangeEventDetails) {
  emit('valueChange', value, eventDetails);
}

function emitUpdateValue(value: string) {
  emit('update:value', value);
}

defineExpose({ element });
</script>

<template>
  <FieldControl
    v-if="$slots.render"
    ref="control"
    v-bind="{ ...withoutPropsOf($attrs, FieldControl), ...props }"
    @value-change="emitValueChange"
    @update:value="emitUpdateValue"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </FieldControl>
  <FieldControl
    v-else
    ref="control"
    v-bind="{ ...withoutPropsOf($attrs, FieldControl), ...props }"
    @value-change="emitValueChange"
    @update:value="emitUpdateValue"
  />
</template>
