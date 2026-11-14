<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface MenuBackdropState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface MenuBackdropProps
  extends
    VaseUIComponentProps<MenuBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuBackdropProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuBackdropState>;
}>();

const { store } = useMenuRootContext();
const contextMenuContext = useContextMenuRootContext();

const state = computed<MenuBackdropState>(() => ({
  open: store.select('open'),
  transitionStatus: store.select('transitionStatus'),
}));

let backdropElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (backdrop) => {
      // A compiled template can mount a new backdrop before it unmounts the old one. The old
      // backdrop then must not clear the element of the new one.
      if (
        contextMenuContext !== undefined &&
        (backdrop !== null || contextMenuContext.backdropRef.value === backdropElement)
      ) {
        contextMenuContext.backdropRef.value = backdrop as HTMLDivElement | null;
      }
      backdropElement = backdrop;
    },
  ],
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      hidden: store.select('mounted') ? undefined : true,
      style: {
        pointerEvents:
          store.select('lastOpenChangeReason') === REASONS.triggerHover ? 'none' : undefined,
        userSelect: 'none',
        '-webkit-user-select': 'none',
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
