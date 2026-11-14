<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export interface NavigationMenuListProps
  extends
    VaseUIComponentProps<NavigationMenuListState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { closest, getTarget } from '../../common/shadowDom';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { getEmptyRootStore } from '../../utils/popups/floating-root/getEmptyRootStore';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { NavigationMenuDismissContext } from './NavigationMenuDismissContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuListProps>(), { as: 'ul' });

defineSlots<{
  default(props: { state: NavigationMenuListState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuListState>;
}>();

const { orientation, open, nested, floatingRootStore, positionerElement, value } =
  useNavigationMenuRootContext();

// The root points at the store of the active trigger. Until a trigger is active, the composable
// reads a closed store.
const fallbackStore = getEmptyRootStore();

const dismiss = useDismiss(() => floatingRootStore.value ?? fallbackStore, {
  enabled: () => positionerElement.value != null || value.value == null,
  outsidePressEvent: 'intentional',
  outsidePress(event) {
    const target = getTarget(event) as HTMLElement | null;
    return closest(target, `[${NAVIGATION_MENU_TRIGGER_IDENTIFIER}]`) === null;
  },
});

const dismissProps = computed(() => (floatingRootStore.value ? dismiss : undefined));
provide(NavigationMenuDismissContext, dismissProps);

const state = computed<NavigationMenuListState>(() => ({ open: open.value }));

// When nested, the triggers and the links take part in the composite of the parent content, so the
// list makes no composite. The root decided `nested` one time.
const composite = nested ? undefined : useCompositeRoot({ loopFocus: false, orientation });

// `stopEventPropagation` won't stop the propagation if the end of the list is reached,
// but we want to block it in this case.
// When nested, skip this handler so arrow keys can reach the parent composite.
function onKeydown(event: KeyboardEvent) {
  const shouldStop =
    (orientation.value === 'horizontal' &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
    (orientation.value === 'vertical' && (event.key === 'ArrowUp' || event.key === 'ArrowDown'));

  if (shouldStop) {
    event.stopPropagation();
  }
}

const { element, elementProps } = useRenderElement('ul', props, {
  state,
  ref: composite ? [composite.rootRef] : [],
  props: (attrs) => [
    composite?.props,
    dismissProps.value?.floating,
    nested ? undefined : { onKeydown },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
