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
  modelValue?: string | number | readonly string[] | undefined;
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
  modelValue: undefined,
});

const emit = defineEmits<{
  /**
   * The input emits this event when the user edits its value.
   */
  valueChange: [value: string, eventDetails: InputChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: string];
}>();

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, InputState>;
}>();

// Separate branches keep the child slots stable across updates.
const control = useTemplateRef('control');
const element = computed(() => control.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FieldControl
    v-if="$slots.render"
    ref="control"
    v-bind="{ ...withoutPropsOf($attrs, FieldControl), ...props }"
    @value-change="(value, details) => emit('valueChange', value, details)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </FieldControl>
  <FieldControl
    v-else
    ref="control"
    v-bind="{ ...withoutPropsOf($attrs, FieldControl), ...props }"
    @value-change="(value, details) => emit('valueChange', value, details)"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
