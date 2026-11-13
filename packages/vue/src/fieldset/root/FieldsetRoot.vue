<script lang="ts">
import type { FieldsetHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetRootProps
  extends
    VaseUIComponentProps<FieldsetRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<FieldsetHTMLAttributes>, 'disabled'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useLabelId } from '../../utils/useRegisteredLabelId';
import { FieldsetRootContext, useFieldsetRootContext } from './FieldsetRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldsetRootProps>(), { as: 'fieldset', disabled: false });

defineSlots<{
  default(props: { state: FieldsetRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldsetRootState>;
}>();

const parentDisabled = useFieldsetRootContext(true)?.disabled;
const isDisabled = computed(() => (parentDisabled?.value ?? false) || props.disabled);
const state = computed<FieldsetRootState>(() => ({ disabled: isDisabled.value }));

const { labelId, defaultLabelId, setLabelId, getAriaLabelledBy } = useLabelId();

provide(FieldsetRootContext, {
  legendId: labelId,
  setLegendId: setLabelId,
  defaultLegendId: defaultLabelId,
  disabled: isDisabled,
});

const { element, elementProps } = useRenderElement('fieldset', props, {
  state,
  props: (attrs) => [
    {
      'aria-labelledby': getAriaLabelledBy(attrs),
      // Vue writes `false` as `disabled="false"` on an element that has no `disabled` property.
      disabled: isDisabled.value ? true : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
