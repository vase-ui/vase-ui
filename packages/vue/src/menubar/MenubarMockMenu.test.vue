<script setup lang="ts">
import { useCompositeItem } from '../internals/composite/item/useCompositeItem';
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

const { compositeProps, compositeRef } = useCompositeItem({ disabled: () => props.disabled });

const { element, elementProps } = useRenderElement('button', props, {
  ref: [compositeRef],
  props: (attrs) => [
    compositeProps.value,
    { role: 'menuitem', disabled: props.disabled || menubar.disabled.value ? '' : undefined },
    attrs,
  ],
});

defineExpose({ element, report, menubar, nodeId, parentNodeId, tree });
</script>

<template>
  <component :is="as" v-bind="elementProps()"><slot /></component>
</template>
