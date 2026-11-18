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
import { createElementSetter } from '../../utils/popups/createElementSetter';
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: [
    createElementSetter(store.context.backdropRef, { keepWhileHeld: true }),
    contextMenuContext && createElementSetter(contextMenuContext.backdropRef),
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
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
