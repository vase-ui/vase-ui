<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { ToolbarRootState } from '../root/ToolbarRoot.vue';

export interface ToolbarButtonState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarButtonProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ToolbarButtonState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
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
}

// The empty string is the value of a bare attribute. On an element that has no `disabled`
// property, a server and a browser then write the same attribute. With `true`, a browser writes
// `disabled="true"`.
const FORWARDED_DISABLED = { disabled: '' };
</script>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import type { ToolbarRootItemMetadata } from '../root/ToolbarRoot.vue';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarButtonProps>(), {
  as: 'button',
  disabled: false,
  focusableWhenDisabled: true,
  nativeButton: true,
});

defineSlots<{
  default(props: { state: ToolbarButtonState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToolbarButtonState>;
}>();

const slots = useSlots();

const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();
const groupContext = useToolbarGroupContext();

const itemDisabled = computed(
  () => toolbarDisabled.value || (groupContext?.disabled.value ?? false) || props.disabled,
);

const itemMetadata = computed<ToolbarRootItemMetadata>(() => ({
  disabled: itemDisabled.value,
  focusableWhenDisabled: props.focusableWhenDisabled,
}));

const { getButtonProps, buttonRef } = useButton({
  disabled: itemDisabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  native: () => props.nativeButton,
});

const state = computed<ToolbarButtonState>(() => ({
  disabled: itemDisabled.value,
  orientation: orientation.value,
  focusable: props.focusableWhenDisabled,
}));

const { compositeProps, compositeRef } = useCompositeItem({
  metadata: itemMetadata,
  disabled: () => itemDisabled.value && !props.focusableWhenDisabled,
});

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [compositeRef, buttonRef],
  props: (attrs) => [
    compositeProps.value,
    attrs,
    // With `as` or a `#render` slot, the element can be another part, such as a menu trigger.
    // That part needs `disabled` to make its own disabled state. The default button gets no
    // `disabled` here, so a disabled button that can get focus still gets hover events, for
    // example for a tooltip. An enabled item gets no key. On an element that has no `disabled`
    // property, a browser writes `false` as `disabled="false"` and a server writes no attribute.
    // The hydrated DOM then differs from a client-only render. Also, `isElementDisabled` and a
    // `[disabled]` selector read the attribute as disabled, whatever its value.
    // TODO: follow up after https://github.com/mui/base-ui/issues/1976#issuecomment-2916905663
    (slots.render || props.as !== 'button') && itemDisabled.value
      ? FORWARDED_DISABLED
      : EMPTY_OBJECT,
    getButtonProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
