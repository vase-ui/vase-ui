<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  Orientation as BaseOrientation,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = BaseOrientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: ToolbarRootOrientation;
}

export interface ToolbarRootProps
  extends
    VaseUIComponentProps<ToolbarRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRootOrientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { ToolbarRootContext } from './ToolbarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarRootProps>(), {
  as: 'div',
  disabled: false,
  orientation: 'horizontal',
  loopFocus: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Toolbar.Root');
}

defineSlots<{
  default(props: { state: ToolbarRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToolbarRootState>;
}>();

provide(ToolbarRootContext, {
  disabled: computed(() => props.disabled),
  orientation: computed(() => props.orientation),
});

const state = computed<ToolbarRootState>(() => ({
  disabled: props.disabled,
  orientation: props.orientation,
}));

const { onFocusin, onFocusout, onKeydown, registerRoot } =
  useCompositeRoot<ToolbarRootItemMetadata>({
    getDisabledIndices: (items) =>
      Array.from(items.values())
        .filter((item) => item.disabled && !item.focusableWhenDisabled)
        .map((item) => item.index),
    loopFocus: () => props.loopFocus,
    orientation: () => props.orientation,
  });

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: registerRoot,
  props: (attrs) => [
    { onFocusin, onFocusout, onKeydown },
    { 'aria-orientation': props.orientation, role: 'toolbar' },
    attrs,
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
