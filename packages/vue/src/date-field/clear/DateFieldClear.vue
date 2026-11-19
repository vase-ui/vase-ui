<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { DateFieldRootState } from '../root/DateFieldRoot.vue';

export interface DateFieldClearState extends DateFieldRootState {}

export interface DateFieldClearProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<DateFieldClearState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction. The button also ignores it while the field
   * is empty, disabled or read-only.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { rootStateAttributesMapping } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import ClearButtonChildren from '../../internals/ClearButtonChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateFieldClearProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DateField.Clear');
}

const slots = defineSlots<{
  /**
   * The content of the button. The default is `x`, and the button then has the `aria-label` `Clear`.
   */
  default(props: { state: DateFieldClearState }): unknown;
  render(props: { props: HTMLProps; state: DateFieldClearState; children: Component }): unknown;
}>();

const context = useDateTimeFieldContext();

const isDisabled = computed(
  () =>
    props.disabled || context.disabled.value || context.readOnly.value || context.state.value.empty,
);

const state = computed<DateFieldClearState>(() => ({
  ...context.state.value,
  disabled: isDisabled.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      native: () => props.nativeButton,
      disabled: isDisabled,
    }),
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  props: (attrs) => [
    {
      // The button names itself only when it shows its own `x`.
      'aria-label': slots.default || slots.render ? undefined : 'Clear',
      onClick(event: MouseEvent) {
        context.clear(event);
      },
    },
    attrs,
  ],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ClearButtonChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <ClearButtonChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ClearButtonChildren>
  </component>
</template>
