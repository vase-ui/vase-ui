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
import { computed } from 'vue';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuListProps>(), { as: 'ul' });

defineSlots<{
  default(props: { state: NavigationMenuListState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuListState>;
}>();

const { orientation, open, nested } = useNavigationMenuRootContext();

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
  props: (attrs) => [composite?.props, nested ? undefined : { onKeydown }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
