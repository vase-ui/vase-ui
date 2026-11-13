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
   * A server render writes the trigger before it renders the panel.
   * The `aria-controls` of an open trigger in the server HTML then names a generated id until the
   * page hydrates. It does not name a panel that has an `id` of its own until then.
   * To correct this, set `aria-controls` on `Accordion.Trigger` to the same id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { warn } from '../../common/warn';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import { useAccordionRootContext } from '../root/AccordionRootContext';
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
  const warnWhenKeepMountedIsIgnored = () => {
    if (props.keepMounted === false && isHiddenUntilFound.value) {
      warn(
        'The `keepMounted` prop of `Accordion.Panel` is `false` and `hiddenUntilFound` is enabled on the panel or on the root.',
        'The panel must stay mounted while it is closed, so `keepMounted` has no effect.',
        'Remove `keepMounted`, or remove `hiddenUntilFound`.',
      );
    }
  };
  onMounted(warnWhenKeepMountedIsIgnored);
  watch([isHiddenUntilFound, () => props.keepMounted], warnWhenKeepMountedIsIgnored);
}

const {
  defaultPanelId,
  mounted,
  onOpenChange,
  open,
  registerPanelId,
  setMounted,
  setOpen,
  transitionStatus,
} = useCollapsibleRootContext();

const panelId = computed(() => props.id || defaultPanelId.value);

const source = Symbol();

useRegisteredId(
  () => panelId.value,
  (getId) => registerPanelId(source, getId),
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
  hiddenUntilFound: isHiddenUntilFound,
  id: () => panelId.value,
  keepMounted: isKeptMounted,
  mounted,
  onOpenChange,
  open,
  setMounted,
  setOpen,
  transitionStatus,
});

const { state, triggerId } = useAccordionItemContext();

const panelState = computed<AccordionPanelState>(() => ({
  ...state.value,
  transitionStatus: panelTransitionStatus.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state: panelState,
  ref: panelRef,
  props: (attrs) => [
    panelProps.value,
    {
      'aria-labelledby': triggerId.value,
      role: 'region',
      style: {
        [AccordionPanelCssVars.accordionPanelHeight]:
          height.value === undefined ? 'auto' : `${height.value}px`,
        [AccordionPanelCssVars.accordionPanelWidth]:
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
  stateAttributesMapping: accordionStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <template v-if="shouldRender">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="panelState" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="panelState" /></component>
  </template>
</template>
