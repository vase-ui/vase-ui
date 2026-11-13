<script lang="ts">
import type { LabelHTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface FieldLabelState extends FieldRootState {}

export interface FieldLabelProps
  extends
    VaseUIComponentProps<FieldLabelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<LabelHTMLAttributes>, 'id'> {
  /**
   * The `id` of the label. The control of the field names it in `aria-labelledby`.
   */
  id?: string | undefined;
  /**
   * Whether the component renders a native `<label>` element when the `as` prop or the `#render`
   * slot replaces it.
   * Set to `false` if the rendered element is not a label (for example, `<div>`).
   *
   * This is useful to avoid inheriting label behaviors on `<button>` controls (such as `<Select.Trigger>` and `<Combobox.Trigger>`), including avoiding `:hover` on the button when hovering the label, and preventing clicks on the label from firing on the button.
   * @default true
   */
  nativeLabel?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { error } from '../../common/error';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useLabel } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldLabelProps>(), { as: 'label', nativeLabel: true });

defineSlots<{
  default(props: { state: FieldLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldLabelState>;
}>();

const fieldRootContext = useFieldRootContext(false);
const fieldItemContext = useFieldItemContext();

const state = computed<FieldLabelState>(() => ({
  ...fieldRootContext.state.value,
  disabled: (fieldRootContext.disabled.value ?? false) || fieldItemContext.disabled.value,
}));

const labelProps = useLabel({ id: () => props.id, native: () => props.nativeLabel });

const { element, elementProps } = useRenderElement('label', props, {
  state,
  props: (attrs) => [labelProps.value, attrs],
  stateAttributesMapping: fieldValidityMapping,
});

if (process.env.NODE_ENV !== 'production') {
  const checkElement = () => {
    const label = element.value;
    if (!label) {
      return;
    }

    const isLabelTag = label.tagName === 'LABEL';

    if (props.nativeLabel && !isLabelTag) {
      error(
        '<Field.Label> expected a <label> element because the `nativeLabel` prop is true.',
        'A non-<label> element has no native label association, so `for` has no effect.',
        'Use a real <label> with the `as` prop or the `#render` slot, or set `nativeLabel` to `false`.',
      );
    } else if (!props.nativeLabel && isLabelTag) {
      error(
        '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false.',
        'A <label> element has native label behavior, but Vase UI treats the label as non-native. This can cause unexpected pointer behavior.',
        'Use a non-<label> element with the `as` prop or the `#render` slot, or set `nativeLabel` to `true`.',
      );
    }
  };

  onMounted(checkElement);
  watch(() => props.nativeLabel, checkElement, { flush: 'post' });
}

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
