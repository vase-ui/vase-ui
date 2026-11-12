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
   * A server render writes the trigger before it renders the panel.
   * The `aria-controls` of an open trigger in the server HTML then names a generated id until the
   * page hydrates. It does not name a panel that has an `id` of its own until then.
   * To correct this, set `aria-controls` on `Collapsible.Trigger` to the same id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, normalizeStyle, onMounted, onScopeDispose, watch } from 'vue';
import { warn } from '../../common/warn';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
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
  setMounted,
  setPanelIdState,
  setOpen,
  state,
  transitionStatus,
} = useCollapsibleRootContext();

const registeredId = computed(() => props.id || undefined);

setPanelIdState((currentId) => registeredId.value ?? (currentId === null ? undefined : currentId));
watch(registeredId, (nextId, previousId) => {
  setPanelIdState((currentId) => (currentId === previousId ? null : currentId));
  setPanelIdState((currentId) => nextId ?? (currentId === null ? undefined : currentId));
});
onScopeDispose(() => {
  setPanelIdState((currentId) => (currentId === registeredId.value ? null : currentId));
});

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
  id: () => registeredId.value ?? defaultPanelId.value,
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

const { element, elementProps: renderElementProps } = useRenderElement('div', props, {
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
  stateAttributesMapping: collapsibleStateAttributesMapping,
});

// `useRenderElement` merges the `style` attribute and `stateStyle` of the consumer after the props
// of the part. The temporary `animation-name: none` and the temporary declarations must win over
// them, so the part merges them last.
function elementProps() {
  const outProps = renderElementProps();

  if (shouldPreventOpenAnimation.value || temporaryStyle.value) {
    outProps.style = normalizeStyle([
      outProps.style,
      shouldPreventOpenAnimation.value ? { animationName: 'none' } : undefined,
      temporaryStyle.value,
    ]);
  }

  return outProps;
}

defineExpose({ element });
</script>

<template>
  <template v-if="shouldRender">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="panelState" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="panelState" /></component>
  </template>
</template>
