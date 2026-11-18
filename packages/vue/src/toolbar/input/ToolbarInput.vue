<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ToolbarRootState } from '../root/ToolbarRoot.vue';

export interface ToolbarInputState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface ToolbarInputAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface ToolbarInputProps
  extends
    VaseUIComponentProps<ToolbarInputState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete' | 'disabled'>,
    /* @vue-ignore */ ToolbarInputAutocomplete {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
  defaultValue?: string | number | string[] | undefined;
}
</script>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useValueBeforeHydration } from '../../common/hydration';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useFormRestoreAsInput } from '../../internals/useFormRestore';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import type { ToolbarRootItemMetadata } from '../root/ToolbarRoot.vue';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarInputProps>(), {
  as: 'input',
  disabled: false,
  focusableWhenDisabled: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Toolbar.Input');
}

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, ToolbarInputState>;
}>();

const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();
const groupContext = useToolbarGroupContext();

const itemDisabled = computed(
  () => toolbarDisabled.value || (groupContext?.disabled.value ?? false) || props.disabled,
);

const itemMetadata = computed<ToolbarRootItemMetadata>(() => ({
  disabled: itemDisabled.value,
  focusableWhenDisabled: props.focusableWhenDisabled,
}));

const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
  composite: true,
  disabled: itemDisabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  isNativeButton: false,
});

const state = computed<ToolbarInputState>(() => ({
  disabled: itemDisabled.value,
  orientation: orientation.value,
  focusable: props.focusableWhenDisabled,
}));

// A server needs the key `value` to write the `value` attribute. In a browser, Vue sets the DOM
// property `value` again on each render, and that replaces the text that the user typed. The DOM
// property `defaultValue` is the `value` attribute, and Vue sets it only when its value changes.
function defaultValueProps() {
  if (props.defaultValue === undefined) {
    return undefined;
  }
  // eslint-disable-next-line no-restricted-globals -- The part has no element before its first render, so `ownerDocument` does not apply. The check finds a server render and reads no DOM.
  return typeof document === 'undefined'
    ? { value: props.defaultValue }
    : { defaultValue: props.defaultValue };
}

function preventWhenDisabled(event: Event) {
  if (itemDisabled.value) {
    event.preventDefault();
  }
}

const { compositeProps, compositeRef } = useCompositeItem({
  metadata: itemMetadata,
  disabled: () => itemDisabled.value && !props.focusableWhenDisabled,
});

const writesValue = useValueBeforeHydration(props, () => element.value);

const attrs = useAttrs();
// An uncontrolled input has no model to compare with a silent browser restore at pageshow.
let lastInputText: string | undefined;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
  state,
  ref: [compositeRef],
  props: (attrs) => {
    // The part declares no `value` prop, so the `value` of the consumer is in `attrs`.
    const { value, ...attrsWithoutValue } = attrs;
    return [
      compositeProps.value,
      {
        onClick: preventWhenDisabled,
        onPointerdown: preventWhenDisabled,
        onInput(event: Event) {
          if (value === undefined) {
            lastInputText = (event.currentTarget as HTMLInputElement).value;
          } else {
            inputRender.renderValue();
          }
        },
      },
      defaultValueProps(),
      attrsWithoutValue,
      writesValue.value && value !== undefined ? inputRender.valueProps() : undefined,
      focusableWhenDisabledProps.value,
    ];
  },
});

const inputRender: ReturnType<typeof useFormRestoreAsInput<unknown>> = useFormRestoreAsInput(
  element,
  () => attrs.value,
  true,
  () => lastInputText,
);
useFormReset(element, () => {
  lastInputText = undefined;
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
