<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface MenubarState {
  /**
   * The orientation of the menubar.
   */
  orientation: Orientation;
  /**
   * Whether the menubar is modal.
   */
  modal: boolean;
  /**
   * Whether any submenu within the menubar is open.
   */
  hasSubmenuOpen: boolean;
}

export interface MenubarProps
  extends
    VaseUIComponentProps<MenubarState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * Whether the menubar is modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the whole menubar is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The orientation of the menubar.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The id of the menubar. The menus of the menubar use it as the id of their root.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, shallowRef } from 'vue';
import { useCompositeRoot } from '../internals/composite/root/useCompositeRoot';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import { MenubarContext } from '../internals/menubar-context/MenubarContext';
import { REASONS } from '../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useVaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import type { MenuOpenEventDetails } from '../menu/utils/types';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
} from '../utils/popups/tree/FloatingTree';
import * as MenubarDataAttributes from './MenubarDataAttributes';

const menubarStateAttributesMapping: StateAttributesMapping<MenubarState> = {
  hasSubmenuOpen(value) {
    return value ? { [MenubarDataAttributes.hasSubmenuOpen]: '' } : null;
  },
};

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenubarProps>(), {
  as: 'div',
  modal: true,
  disabled: false,
  orientation: 'horizontal',
  loopFocus: true,
});

defineSlots<{
  default(props: { state: MenubarState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenubarState>;
}>();

const contentElement = shallowRef<HTMLElement | null>(null);
const hasSubmenuOpen = shallowRef(false);
const allowMouseUpTriggerRef = shallowRef(false);

const rootId = useVaseUiId(() => props.id);

function setHasSubmenuOpen(open: boolean) {
  hasSubmenuOpen.value = open;
}

provide(MenubarContext, {
  contentElement,
  hasSubmenuOpen,
  setHasSubmenuOpen,
  modal: computed(() => props.modal),
  disabled: computed(() => props.disabled),
  orientation: computed(() => props.orientation),
  allowMouseUpTriggerRef,
  rootId,
});

const tree = provideFloatingTree();
const nodeId = useFloatingNodeId(tree);
provideFloatingNode(nodeId);

// The part gives no external tree, so `tree.value` is always its own store. `setup` runs one time.
// The listener thus needs no removal and no new subscription.
tree.value.events.on('menuopenchange', (details: MenuOpenEventDetails) => {
  if (!details.nodeId || details.parentNodeId !== nodeId) {
    return;
  }

  if (details.open) {
    setHasSubmenuOpen(true);
  } else if (details.reason !== REASONS.siblingOpen && details.reason !== REASONS.listNavigation) {
    setHasSubmenuOpen(false);
  }
});

const state = computed<MenubarState>(() => ({
  orientation: props.orientation,
  modal: props.modal,
  hasSubmenuOpen: hasSubmenuOpen.value,
}));

const { props: compositeProps, rootRef } = useCompositeRoot({
  orientation: () => props.orientation,
  loopFocus: () => props.loopFocus,
  enableHomeAndEndKeys: true,
  highlightItemOnHover: hasSubmenuOpen,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: menubarStateAttributesMapping,
  ref: [
    rootRef,
    (menubar) => {
      contentElement.value = menubar;
    },
  ],
  props: (attrs) => [
    compositeProps,
    { role: 'menubar', id: rootId.value, 'aria-orientation': props.orientation },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
