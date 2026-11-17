<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { CollapsibleRootState } from '../root/CollapsibleRoot.vue';

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsiblePanelProps
  extends
    VaseUIComponentProps<CollapsiblePanelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * The id of the panel. The trigger uses it for `aria-controls`.
   * If the id is absent or empty, the panel has the id that the root generates.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { warn } from '../../common/warn';
import { given } from '../../internals/givenAttributes';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import { collapsibleStateAttributesMapping } from '../root/stateAttributesMapping';
import * as CollapsiblePanelCssVars from './CollapsiblePanelCssVars';
import { useCollapsiblePanel } from './useCollapsiblePanel';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsiblePanelProps>(), {
  as: 'div',
  hiddenUntilFound: false,
  keepMounted: undefined,
});

defineSlots<{
  default(props: { state: CollapsiblePanelState }): unknown;
  render: ComponentRenderFn<HTMLProps, CollapsiblePanelState>;
}>();

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Collapsible.Panel');
  // Only an explicit `keepMounted={false}` gets the warning, so the prop has no default.
  const warnWhenKeepMountedIsIgnored = () => {
    if (props.hiddenUntilFound && props.keepMounted === false) {
      warn(
        'The `keepMounted` prop of `Collapsible.Panel` is `false` and `hiddenUntilFound` is enabled.',
        'The panel must stay mounted while it is closed, so `keepMounted` has no effect.',
        'Remove `keepMounted`, or remove `hiddenUntilFound`.',
      );
    }
  };
  onMounted(warnWhenKeepMountedIsIgnored);
  watch([() => props.hiddenUntilFound, () => props.keepMounted], warnWhenKeepMountedIsIgnored);
}

const {
  defaultPanelId,
  mounted,
  onOpenChange,
  open,
  registerPanelId,
  setMounted,
  setOpen,
  state,
  transitionStatus,
} = useCollapsibleRootContext();

const panelId = computed(() => given('id', props.id) ?? defaultPanelId.value);

useRegisteredId(
  () => panelId.value,
  registerPanelId,
  () => element.value,
);

const {
  height,
  props: panelProps,
  ref: panelRef,
  shouldPreventOpenAnimation,
  shouldRender,
  temporaryStyle,
  transitionStatus: panelTransitionStatus,
  width,
} = useCollapsiblePanel({
  hiddenUntilFound: () => props.hiddenUntilFound,
  id: () => panelId.value,
  keepMounted: () => props.keepMounted ?? false,
  mounted,
  onOpenChange,
  open,
  setMounted,
  setOpen,
  transitionStatus,
});

const panelState = computed<CollapsiblePanelState>(() => ({
  ...state.value,
  transitionStatus: panelTransitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state: panelState,
  ref: panelRef,
  props: (attrs) => [
    panelProps.value,
    {
      style: {
        [CollapsiblePanelCssVars.collapsiblePanelHeight]:
          height.value === undefined ? 'auto' : `${height.value}px`,
        [CollapsiblePanelCssVars.collapsiblePanelWidth]:
          width.value === undefined ? 'auto' : `${width.value}px`,
      },
    },
    attrs,
  ],
  // The temporary `animation-name: none` and the temporary declarations must win over the style of
  // the consumer.
  overridingStyle: () =>
    shouldPreventOpenAnimation.value
      ? { animationName: 'none', ...temporaryStyle.value }
      : temporaryStyle.value,
  stateAttributesMapping: collapsibleStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shouldRender && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="panelState"
  />
  <component :is="as" v-else-if="shouldRender" v-bind="elementProps()" :ref="setRef">
    <slot :state="panelState" />
  </component>
</template>
