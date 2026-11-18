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
import { computed, shallowRef, useSlots, type ShallowRef } from 'vue';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
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

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Toolbar.Button');
}

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

const state = computed<ToolbarButtonState>(() => ({
  disabled: itemDisabled.value,
  orientation: orientation.value,
  focusable: props.focusableWhenDisabled,
}));

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const compositeItem = useCompositeItem(element, {
  metadata: itemMetadata,
  disabled: () => itemDisabled.value && !props.focusableWhenDisabled,
});

const { elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  elementRef: element,
  button: (element) =>
    useButton(element, {
      disabled: itemDisabled,
      focusableWhenDisabled: () => props.focusableWhenDisabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => [
    compositeItem.attributes.value,
    compositeItem.events,
    attrs,
    // A custom target needs the disabled prop even when its native button keeps focus.
    (slots.render || props.as !== 'button') && itemDisabled.value ? FORWARDED_DISABLED : undefined,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
