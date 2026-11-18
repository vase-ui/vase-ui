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
import { computed, onMounted, watchEffect } from 'vue';
import { warn } from '../../common/warn';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  collapsibleStateAttributesMapping,
  useCollapsibleRootContext,
} from '../root/CollapsibleRootContext';
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
  onMounted(() => {
    watchEffect(() => {
      if (props.hiddenUntilFound && props.keepMounted === false) {
        warn(
          'The `keepMounted` prop of `Collapsible.Panel` is `false` and `hiddenUntilFound` is enabled.',
          'The panel must stay mounted while it is closed, so `keepMounted` has no effect.',
          'Remove `keepMounted`, or remove `hiddenUntilFound`.',
        );
      }
    });
  });
}

const root = useCollapsibleRootContext();
const {
  element,
  id: panelId,
  hidden,
  persistStartingStyle,
  handleAnimationEnd,
  handleBeforeMatch,
  height,
  width,
  shouldRender,
  overridingStyle,
  transitionStatus,
} = useCollapsiblePanel(root, props);

const panelState = computed<CollapsiblePanelState>(() => ({
  ...root.state.value,
  transitionStatus: transitionStatus.value,
}));

const { elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state: panelState,
  elementRef: element,
  props: (attrs) => [
    {
      ...(persistStartingStyle.value && { 'data-starting-style': '' }),
      hidden: hidden.value,
      id: panelId.value,
      onAnimationend: handleAnimationEnd,
      onBeforematch: handleBeforeMatch,
      style: {
        [CollapsiblePanelCssVars.collapsiblePanelHeight]: height.value,
        [CollapsiblePanelCssVars.collapsiblePanelWidth]: width.value,
      },
    },
    attrs,
  ],
  overridingStyle,
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
