<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { AccordionItemState } from '../item/AccordionItem.vue';

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AccordionPanelProps
  extends
    VaseUIComponentProps<AccordionPanelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * The id of the panel. The trigger uses it for `aria-controls`.
   * If the id is absent or empty, the panel has the id that the item generates.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, watchEffect } from 'vue';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { warn } from '../../common/warn';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import {
  accordionStateAttributesMapping,
  useAccordionRootContext,
} from '../root/AccordionRootContext';
import * as AccordionPanelCssVars from './AccordionPanelCssVars';

defineOptions({ inheritAttrs: false });

// An absent Boolean prop is `false` in Vue. These two props stay `undefined`, because an absent
// prop takes the value of the root, and only an explicit `keepMounted={false}` gets the warning.
const props = withDefaults(defineProps<AccordionPanelProps>(), {
  as: 'div',
  hiddenUntilFound: undefined,
  keepMounted: undefined,
});

defineSlots<{
  default(props: { state: AccordionPanelState }): unknown;
  render: ComponentRenderFn<HTMLProps, AccordionPanelState>;
}>();

const { hiddenUntilFound: contextHiddenUntilFound, keepMounted: contextKeepMounted } =
  useAccordionRootContext();

const isHiddenUntilFound = computed(() => props.hiddenUntilFound ?? contextHiddenUntilFound.value);
const isKeptMounted = computed(() => props.keepMounted ?? contextKeepMounted.value);

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Accordion.Panel');
  onMounted(() => {
    watchEffect(() => {
      if (props.keepMounted === false && isHiddenUntilFound.value) {
        warn(
          'The `keepMounted` prop of `Accordion.Panel` is `false` and `hiddenUntilFound` is enabled on the panel or on the root.',
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
} = useCollapsiblePanel(root, {
  id: () => props.id,
  hiddenUntilFound: isHiddenUntilFound,
  keepMounted: isKeptMounted,
});

const { state, triggerId } = useAccordionItemContext();

// The trigger registers its id in `setup`, and it can come after the panel.
useDeferredServerRender();

const panelState = computed<AccordionPanelState>(() => ({
  ...state.value,
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
      'aria-labelledby': triggerId.value,
      role: 'region',
      style: {
        [AccordionPanelCssVars.accordionPanelHeight]: height.value,
        [AccordionPanelCssVars.accordionPanelWidth]: width.value,
      },
    },
    attrs,
  ],
  overridingStyle,
  stateAttributesMapping: accordionStateAttributesMapping,
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
