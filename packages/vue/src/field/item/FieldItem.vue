<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps
  extends VaseUIComponentProps<FieldItemState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
import { provideLabelableContext } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { FieldItemContext } from './FieldItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldItemProps>(), { as: 'div', disabled: false });

defineSlots<{
  default(props: { state: FieldItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldItemState>;
}>();

const { state: fieldState, disabled: rootDisabled } = useFieldRootContext(false);

const isDisabled = computed(() => (rootDisabled.value ?? false) || props.disabled);
const state = computed<FieldItemState>(() => ({ ...fieldState.value, disabled: isDisabled.value }));

provideLabelableContext();
provide(FieldItemContext, { disabled: isDisabled });

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
