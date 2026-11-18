<script setup lang="ts">
import { useCompositeItem } from '../internals/composite/root/useCompositeRoot';
import { useMenubarContext } from '../internals/menubar-context/MenubarContext';
import { useRenderElement } from '../internals/useRenderElement';
import type { MenuOpenEventDetails } from '../menu/utils/types';
import {
  provideFloatingNode,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from '../utils/popups/tree/FloatingTree';

// A menu as the menubar sees it: an item of the composite and a node of the popup tree. `report`
// sends the `menuopenchange` event that a menu sends on the tree when it opens or closes.

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{ as?: string; disabled?: boolean }>(), {
  as: 'button',
  disabled: false,
});

const menubar = useMenubarContext();
const tree = useFloatingTree();
const parentNodeId = useFloatingParentNodeId();
const nodeId = useFloatingNodeId();
provideFloatingNode(nodeId);

function report(
  open: boolean,
  reason: MenuOpenEventDetails['reason'] = null,
  overrides: Partial<MenuOpenEventDetails> = {},
) {
  const details: MenuOpenEventDetails = {
    open,
    reason,
    nodeId,
    parentNodeId: parentNodeId.value,
    ...overrides,
  };
  tree.value?.events.emit('menuopenchange', details);
}

const { element, elementProps, setRef } = useRenderElement('button', props, {
  props: (attrs) => [
    compositeItem.attributes.value,
    compositeItem.events,
    { role: 'menuitem', disabled: props.disabled || menubar.disabled.value ? '' : undefined },
    attrs,
  ],
});

const compositeItem: ReturnType<typeof useCompositeItem> = useCompositeItem(element, {
  disabled: () => props.disabled,
});

defineExpose({ element, report, menubar, nodeId, parentNodeId, tree });
</script>

<template>
  <component :is="as" v-bind="elementProps()" :ref="setRef"><slot /></component>
</template>
